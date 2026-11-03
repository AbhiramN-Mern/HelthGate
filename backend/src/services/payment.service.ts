import crypto from "crypto";
import mongoose from "mongoose";
import { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPaymentGateway, VerifyPaymentParams } from "../infrastructure/payment/IPaymentGateway.js";
import { NotificationService } from "./notification.service.js";
import { ITransactionManager } from "../core/transactions/ITransactionManager.js";
import { MongooseTransactionManager } from "../infrastructure/transactions/MongooseTransactionManager.js";
import AppointmentModel from "../models/appointment.model.js";
import OutboxEventModel from "../models/outboxEvent.model.js";
import WebhookEventModel from "../models/webhookEvent.model.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors/AppError.js";
import { createPaginatedResponse } from "../utils/pagination.js";

export const DEFAULT_CONSULTATION_FEE = 500;

export class PaymentService {
  private transactionManager: ITransactionManager;

  constructor(
    private paymentRepo: IPaymentRepository,
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private notificationRepo: INotificationRepository,
    private userRepo: IUserRepository,
    private paymentGateway: IPaymentGateway,
    private notificationService?: NotificationService,
    transactionManager?: ITransactionManager,
  ) {
    this.transactionManager = transactionManager || new MongooseTransactionManager();
  }

  /**
   * Switches or retrieves the current payment gateway (supports runtime inversion if needed)
   */
  getGateway(): IPaymentGateway {
    return this.paymentGateway;
  }

  setGateway(gateway: IPaymentGateway) {
    this.paymentGateway = gateway;
  }

  /**
   * Sets or retrieves the transaction manager
   */
  getTransactionManager(): ITransactionManager {
    return this.transactionManager;
  }

  setTransactionManager(manager: ITransactionManager) {
    this.transactionManager = manager;
  }

  /**
   * Create a new payment order for an existing appointment
   */
  async createPaymentOrder(data: {
    patientUserId: string;
    bookingId: string;
  }) {
    const { patientUserId, bookingId } = data;

    if (!bookingId) {
      throw new BadRequestError("Appointment bookingId is required to initiate payment");
    }

    const appointment = await this.appointmentRepo.findById(bookingId, true);
    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const apptPatientId = String(
      (appointment.patient as any)?._id || appointment.patient,
    );
    if (apptPatientId !== String(patientUserId)) {
      throw new ForbiddenError("You are not authorized to pay for this appointment");
    }

    if (appointment.status === "cancelled" || appointment.status === "expired" || appointment.status === "EXPIRED") {
      throw new BadRequestError("Cannot make payment for a cancelled or expired appointment");
    }

    if (appointment.status === "completed") {
      throw new BadRequestError("This appointment has already been completed");
    }

    const isReservationExpired =
      (appointment.paymentExpiresAt && new Date(appointment.paymentExpiresAt) <= new Date()) ||
      (appointment.bookingExpiresAt && new Date(appointment.bookingExpiresAt) <= new Date()) ||
      appointment.status === "expired" ||
      appointment.status === "EXPIRED";

    if (isReservationExpired) {
      throw new BadRequestError(
        "This booking reservation has expired. Please select an available slot and book again.",
      );
    }

    // Check if an existing payment is already SUCCESS
    const existingPayments = await this.paymentRepo.findByBookingId(bookingId, false);
    const hasSuccessfulPayment = existingPayments.some(
      (p) => p.status === "SUCCESS",
    );
    if (hasSuccessfulPayment || String(appointment.status).toLowerCase() === "confirmed") {
      throw new ConflictError("This appointment is already paid and confirmed");
    }

    // Determine consultation fee based on consultationType (online vs offline pricing tier)
    const isOffline = (appointment.consultationType || "").toLowerCase() === "offline";
    let fee = DEFAULT_CONSULTATION_FEE;
    const doctorObj = appointment.doctor;
    let docDoc: any = doctorObj;
    if ((!docDoc?.consultationFee && !docDoc?.offlineConsultationFee) && doctorObj?._id) {
      docDoc = await this.doctorRepo.findById(doctorObj._id, false);
    }

    if (isOffline) {
      if (typeof docDoc?.offlineConsultationFee === "number" && docDoc.offlineConsultationFee > 0) {
        fee = docDoc.offlineConsultationFee;
      } else if (typeof docDoc?.consultationFee === "number" && docDoc.consultationFee > 0) {
        fee = docDoc.consultationFee + 200;
      } else {
        fee = DEFAULT_CONSULTATION_FEE + 200;
      }
    } else {
      if (typeof docDoc?.consultationFee === "number" && docDoc.consultationFee > 0) {
        fee = docDoc.consultationFee;
      }
    }

    // Create order with payment gateway
    const orderResult = await this.paymentGateway.createOrder({
      amount: fee,
      currency: "INR",
      receipt: `rcpt_${appointment._id}`,
      notes: {
        appointmentId: String(appointment._id),
        patientUserId: String(patientUserId),
      },
    });

    // Persist PENDING payment document
    const payment = await this.paymentRepo.create({
      bookingId: appointment._id,
      patientId: patientUserId as any,
      amount: fee,
      currency: orderResult.currency || "INR",
      status: "PENDING",
      provider: orderResult.provider,
      providerOrderId: orderResult.providerOrderId,
      providerPaymentId: null,
      failureReason: null,
      refundStatus: "NONE",
    });

    return {
      payment,
      order: orderResult,
      appointment,
    };
  }

  /**
   * Server-side payment verification (Idempotent, Transactional & Secure)
   */
  async verifyPayment(data: {
    patientUserId: string;
    paymentId?: string;
    providerOrderId?: string;
    providerPaymentId?: string;
    razorpaySignature?: string;
    simulateStatus?: "SUCCESS" | "FAILED";
    failureReason?: string;
    mockToken?: string;
  }) {
    const {
      patientUserId,
      paymentId,
      providerOrderId,
      providerPaymentId,
      razorpaySignature,
      simulateStatus,
      failureReason,
      mockToken,
    } = data;

    // Locate the payment record either by DB ID or providerOrderId
    let payment: any = null;
    if (paymentId) {
      payment = await this.paymentRepo.findById(paymentId, true);
    } else if (providerOrderId) {
      payment = await this.paymentRepo.findOne({ providerOrderId }, true);
    }

    if (!payment) {
      throw new NotFoundError("Payment record not found for verification");
    }

    // Ownership check: patient can only verify their own payment
    const paymentPatientId = String(
      (payment.patientId as any)?._id || payment.patientId,
    );
    if (paymentPatientId !== String(patientUserId)) {
      throw new ForbiddenError("Unauthorized to verify this payment transaction");
    }

    // Idempotency: If already marked SUCCESS, return existing record immediately
    if (payment.status === "SUCCESS") {
      const currentAppointment = await this.appointmentRepo.findById(payment.bookingId, true);
      return {
        success: true,
        message: "Payment was already verified successfully",
        payment,
        appointment: currentAppointment || payment.bookingId,
      };
    }

    // Verify using the configured payment gateway OUTSIDE of any MongoDB transaction
    const verificationParams: VerifyPaymentParams = {
      providerOrderId: payment.providerOrderId || providerOrderId || "",
      providerPaymentId,
      razorpaySignature,
      simulateStatus,
      failureReason,
      mockToken,
    };

    const result = await this.paymentGateway.verifyPayment(verificationParams);

    if (result.success) {
      const bookingId = (payment.bookingId as any)?._id || payment.bookingId;
      const now = new Date();
      const isDbConnected = mongoose.connection.readyState === 1;

      // Open a MongoDB transaction to atomically confirm appointment, update payment and write outbox event
      type TxResult = {
        confirmed: boolean;
        alreadyConfirmed: boolean;
        expired: boolean;
        confirmedAppointment: any;
      };

      const txResult: TxResult = await this.transactionManager.executeTransaction(
        async (session) => {
          // 1. Attempt atomic confirmation on the appointment (checks pending_payment and bookingExpiresAt > now)
          const confirmedAppt = this.appointmentRepo.atomicConfirmPayment
            ? await this.appointmentRepo.atomicConfirmPayment(bookingId, now, session)
            : await this.appointmentRepo.updateStatus(bookingId, "confirmed");

          if (confirmedAppt) {
            // Appointment successfully claimed and confirmed! Transition payment to SUCCESS
            if (this.paymentRepo.transitionToSuccess) {
              await this.paymentRepo.transitionToSuccess(
                payment._id,
                result.providerPaymentId,
                session,
              );
            } else {
              await this.paymentRepo.updateStatus(payment._id, "SUCCESS", {
                providerPaymentId: result.providerPaymentId,
                failureReason: null,
              });
            }

            // Write transactional Outbox event for reliable notification delivery if DB connected
            if (isDbConnected) {
              const outboxEvent = new OutboxEventModel({
                aggregateType: "APPOINTMENT",
                aggregateId: String(bookingId),
                eventType: "APPOINTMENT_CONFIRMED",
                payload: {
                  appointmentId: String(bookingId),
                  patientId: String(patientUserId),
                  amount: payment.amount,
                },
                status: "PENDING",
              });
              await outboxEvent.save({ session });
            }

            return {
              confirmed: true,
              alreadyConfirmed: false,
              expired: false,
              confirmedAppointment: confirmedAppt,
            };
          }

          // 2. atomicConfirmPayment returned null. Check if already confirmed (idempotent race)
          let existingAppt: any = null;
          if (isDbConnected) {
            existingAppt = await AppointmentModel.findById(bookingId).session(session).exec();
          } else {
            existingAppt = await this.appointmentRepo.findById(bookingId, false);
          }

          if (existingAppt && String(existingAppt.status).toLowerCase() === "confirmed") {
            if (this.paymentRepo.transitionToSuccess) {
              await this.paymentRepo.transitionToSuccess(
                payment._id,
                result.providerPaymentId,
                session,
              );
            } else {
              await this.paymentRepo.updateStatus(payment._id, "SUCCESS", {
                providerPaymentId: result.providerPaymentId,
                failureReason: null,
              });
            }
            return {
              confirmed: false,
              alreadyConfirmed: true,
              expired: false,
              confirmedAppointment: existingAppt,
            };
          }

          // 3. Appointment is expired or cancelled!
          return {
            confirmed: false,
            alreadyConfirmed: false,
            expired: true,
            confirmedAppointment: existingAppt,
          };
        },
      );

      // Handle successful confirmation
      if (txResult.confirmed || txResult.alreadyConfirmed) {
        const updatedPayment = await this.paymentRepo.findById(payment._id, true);
        const populatedAppointment =
          (await this.appointmentRepo.findById(bookingId, true)) || txResult.confirmedAppointment;

        // Try direct notification delivery as best effort (outbox worker guarantees reliable delivery)
        try {
          if (this.notificationService) {
            await this.notificationService.sendAppointmentConfirmation(populatedAppointment);
          } else {
            const patientUser = await this.userRepo.findById(patientUserId);
            const doctorUserId =
              (populatedAppointment?.doctor as any)?.user?._id ||
              (populatedAppointment?.doctor as any)?.user;

            await this.notificationRepo.create({
              recipient: patientUserId as any,
              type: "payment_success",
              title: "Payment Confirmed",
              message: `Your payment of ₹${payment.amount} for appointment on ${
                populatedAppointment?.appointmentDate
                  ? new Date(populatedAppointment.appointmentDate).toLocaleDateString()
                  : ""
              } was successful. Your appointment is now confirmed.`,
              appointment: bookingId,
            });

            if (doctorUserId) {
              await this.notificationRepo.create({
                recipient: doctorUserId as any,
                type: "appointment_confirmed",
                title: "Appointment Confirmed & Paid",
                message: `Patient ${patientUser?.name || ""} confirmed appointment on ${
                  populatedAppointment?.appointmentDate
                    ? new Date(populatedAppointment.appointmentDate).toLocaleDateString()
                    : ""
                } (₹${payment.amount} paid).`,
                appointment: bookingId,
              });
            }
          }
        } catch (notifErr) {
          console.warn("[PaymentService] Direct notification delivery skipped, outbox worker will deliver:", notifErr);
        }

        return {
          success: true,
          message: txResult.alreadyConfirmed
            ? "Payment verified successfully (appointment already confirmed)"
            : "Payment verified successfully and appointment confirmed",
          payment: updatedPayment,
          appointment: populatedAppointment,
        };
      }

      // 4. Late payment received after reservation expired or cancelled!
      console.warn(
        `[PaymentService] Late payment captured for expired/cancelled appointment ${bookingId}. Initiating safe refund reconciliation.`,
      );

      // Persist durable idempotency key and identical payload for retries
      const idempotencyKey =
        payment.refundIdempotencyKey ||
        `rfnd_idem_${payment._id}_${payment.providerOrderId || Date.now()}`;
      const refundPayload = {
        providerPaymentId: result.providerPaymentId,
        amount: payment.amount,
        reason: "Late payment received after booking reservation expired",
      };

      // Acquire refund lock atomically via conditional database update before calling external API
      const lockedPayment = await this.paymentRepo.acquireRefundLock(
        payment._id,
        idempotencyKey,
        refundPayload,
      );

      let refundId = payment.refundId || "";
      let refundStatus = "processed";
      let refundSuccess = true;

      if (lockedPayment) {
        // Execute external Razorpay refund OUTSIDE transaction with X-Refund-Idempotency header
        const refundResult = await this.paymentGateway.refundPayment({
          providerPaymentId: result.providerPaymentId,
          amount: payment.amount,
          reason: "Late payment received after booking reservation expired",
          idempotencyKey,
        });

        refundId = refundResult.refundId;
        refundSuccess = refundResult.success;
        refundStatus = refundResult.status;

        if (refundResult.status === "processed" || refundResult.success) {
          // Open transaction to mark REFUNDED and write outbox event
          await this.transactionManager.executeTransaction(async (session) => {
            await this.paymentRepo.transitionToRefunded(
              payment._id,
              refundResult.refundId,
              new Date(),
              session,
            );

            if (isDbConnected) {
              const refundOutbox = new OutboxEventModel({
                aggregateType: "PAYMENT",
                aggregateId: String(payment._id),
                eventType: "PAYMENT_REFUNDED",
                payload: {
                  paymentId: String(payment._id),
                  bookingId: String(bookingId),
                  patientId: String(patientUserId),
                  amount: payment.amount,
                  currency: payment.currency || "INR",
                  refundId: refundResult.refundId,
                },
                status: "PENDING",
              });
              await refundOutbox.save({ session });
            }
          });

          try {
            await this.notificationRepo.create({
              recipient: patientUserId as any,
              type: "payment_refunded",
              title: "Payment Refunded - Reservation Expired",
              message: `Your payment of ₹${payment.amount} was received after your 10-minute booking reservation expired. The slot could not be secured, and a full refund has been initiated (Refund ID: ${refundResult.refundId}).`,
              appointment: bookingId,
            });
          } catch (notifErr) {
            console.warn("[PaymentService] Failed to send direct refund notification:", notifErr);
          }
        } else if (refundResult.status === "pending") {
          await this.paymentRepo.transitionToRefundPending(payment._id, refundResult.refundId);
        } else {
          await this.paymentRepo.transitionToRefundFailed(
            payment._id,
            refundResult.failureReason || "Gateway refund failed",
          );
        }
      } else {
        // Refund was already locked or processed by a concurrent thread/webhook
        const refreshedPayment = await this.paymentRepo.findById(payment._id, false);
        refundId = refreshedPayment?.refundId || "";
        refundStatus = refreshedPayment?.refundStatus || "PROCESSED";
      }

      const finalPayment = await this.paymentRepo.findById(payment._id, true);
      const currentAppointment = await this.appointmentRepo.findById(bookingId, true);

      return {
        success: false,
        expired: true,
        refunded: refundSuccess,
        refundId,
        message:
          "Your booking reservation expired before payment was completed. The slot was released, and a full refund has been initiated.",
        payment: finalPayment,
        appointment: currentAppointment,
      };
    } else {
      // Payment Failed: Mark payment FAILED, preserving audit record. Do not confirm appointment.
      const updatedPayment = this.paymentRepo.transitionToFailed
        ? await this.paymentRepo.transitionToFailed(
            payment._id,
            result.failureReason || "Payment failed or was declined",
          )
        : await this.paymentRepo.updateStatus(payment._id, "FAILED", {
            failureReason: result.failureReason || "Payment failed or was declined",
          });

      const bookingId = (payment.bookingId as any)?._id || payment.bookingId;
      const currentAppointment = await this.appointmentRepo.findById(bookingId, true);

      return {
        success: false,
        message: result.failureReason || "Payment verification failed",
        payment: updatedPayment,
        appointment: currentAppointment,
        canRetry: true,
      };
    }
  }

  /**
   * Retry a failed payment by creating a brand new order attempt
   * (Preserves original failed transaction audit history)
   */
  async retryPayment(data: {
    patientUserId: string;
    paymentId: string;
  }) {
    const { patientUserId, paymentId } = data;

    const originalPayment = await this.paymentRepo.findById(paymentId, true);
    if (!originalPayment) {
      throw new NotFoundError("Payment record not found");
    }

    const originalPatientId = String(
      (originalPayment.patientId as any)?._id || originalPayment.patientId,
    );
    if (originalPatientId !== String(patientUserId)) {
      throw new ForbiddenError("You are not authorized to retry this payment");
    }

    if (originalPayment.status === "SUCCESS") {
      throw new BadRequestError("This payment is already successful and cannot be retried");
    }

    const bookingId = (originalPayment.bookingId as any)?._id || originalPayment.bookingId;
    const appointment = await this.appointmentRepo.findById(bookingId, true);
    if (!appointment) {
      throw new NotFoundError("Associated appointment no longer exists");
    }

    if (
      appointment.status === "cancelled" ||
      appointment.status === "completed" ||
      appointment.status === "expired" ||
      appointment.status === "EXPIRED"
    ) {
      throw new BadRequestError(`Cannot pay for an appointment that is already ${appointment.status}`);
    }

    const isRetryExpired =
      (appointment.paymentExpiresAt && new Date(appointment.paymentExpiresAt) <= new Date()) ||
      (appointment.bookingExpiresAt && new Date(appointment.bookingExpiresAt) <= new Date());
    if (isRetryExpired) {
      throw new BadRequestError(
        "This booking reservation has expired. Please select an available slot and book again.",
      );
    }

    // Check if another transaction already succeeded for this booking
    const existingPayments = await this.paymentRepo.findByBookingId(bookingId, false);
    const hasSuccessfulPayment = existingPayments.some((p) => p.status === "SUCCESS");
    if (hasSuccessfulPayment || String(appointment.status).toLowerCase() === "confirmed") {
      throw new ConflictError("This appointment is already paid and confirmed by another transaction");
    }

    // Generate fresh order via gateway
    const orderResult = await this.paymentGateway.createOrder({
      amount: originalPayment.amount,
      currency: originalPayment.currency || "INR",
      receipt: `retry_${bookingId}_${Date.now()}`,
      notes: {
        appointmentId: String(bookingId),
        retryFromPaymentId: String(originalPayment._id),
      },
    });

    // Create a NEW payment attempt in PENDING status (original remains FAILED in audit history)
    const newPayment = await this.paymentRepo.create({
      bookingId,
      patientId: patientUserId as any,
      amount: originalPayment.amount,
      currency: originalPayment.currency || "INR",
      status: "PENDING",
      provider: orderResult.provider,
      providerOrderId: orderResult.providerOrderId,
      providerPaymentId: null,
      failureReason: null,
      refundStatus: "NONE",
    });

    return {
      success: true,
      message: "New payment attempt created successfully",
      payment: newPayment,
      order: orderResult,
      appointment,
    };
  }

  /**
   * Get payment history for authenticated patient or admin
   */
  async getPaymentHistory(data: {
    patientUserId: string;
    role: string;
    status?: string;
    page?: number;
    limit?: number;
  }) {
    const { patientUserId, role, status, page = 1, limit = 20 } = data;

    const filter: Record<string, unknown> = {};

    // Patient can only see their own payments; Admin can see all
    if (role !== "admin") {
      filter.patientId = patientUserId;
    }

    if (status && status.trim() && status.toLowerCase() !== "all") {
      filter.status = status.trim().toUpperCase();
    }

    const skip = (Math.max(page, 1) - 1) * limit;

    const [payments, total] = await Promise.all([
      this.paymentRepo.find(filter, true, { createdAt: -1 }, limit, skip),
      this.paymentRepo.count(filter),
    ]);

    const paginated = createPaginatedResponse(payments, total, page, limit);

    return {
      ...paginated,
      payments,
      total,
      page,
      limit,
      totalPages: paginated.totalPages,
    };
  }

  /**
   * Get specific payment details with authorization checks
   */
  async getPaymentById(data: {
    patientUserId: string;
    role: string;
    paymentId: string;
  }) {
    const { patientUserId, role, paymentId } = data;

    const payment = await this.paymentRepo.findById(paymentId, true);
    if (!payment) {
      throw new NotFoundError("Payment not found");
    }

    const paymentPatientId = String(
      (payment.patientId as any)?._id || payment.patientId,
    );
    if (role !== "admin" && paymentPatientId !== String(patientUserId)) {
      throw new ForbiddenError("You are not authorized to view this payment");
    }

    return payment;
  }

  /**
   * Process asynchronous webhook from payment gateway with crash-safe lease fencing and idempotency
   */
  async handleWebhook(data: {
    signature?: string;
    eventId?: string;
    payload: any;
    rawBody?: string | Buffer;
  }) {
    const { payload, signature, rawBody } = data;

    // Webhook signature verification if signature is supplied
    if (signature && rawBody) {
      const isValid = this.paymentGateway.verifyWebhookSignature(rawBody, signature);
      if (!isValid) {
        throw new BadRequestError("Invalid webhook signature");
      }
    }

    const eventType = payload?.event || "unknown";
    const entity =
      payload?.payload?.payment?.entity ||
      payload?.payload?.refund?.entity ||
      payload?.payload?.order?.entity ||
      {};
    const providerOrderId = entity.order_id || null;
    const providerPaymentId = entity.payment_id || entity.id || null;

    // Derive or extract durable unique eventId
    const eventId =
      data.eventId ||
      payload?.event_id ||
      payload?.id ||
      (providerPaymentId ? `${eventType}_${providerPaymentId}` : null) ||
      crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");

    const isDbConnected = mongoose.connection.readyState === 1;

    // Atomic lease acquisition to prevent race conditions & duplicate processing
    const leaseToken = crypto.randomUUID();
    const leaseDurationMs = 60000; // 60 seconds
    const lockedUntil = new Date(Date.now() + leaseDurationMs);

    let claimed = !isDbConnected; // Auto-claimed in disconnected in-memory unit tests
    if (isDbConnected) {
      try {
        await WebhookEventModel.create({
          eventId,
          eventType,
          providerOrderId,
          status: "PROCESSING",
          leaseToken,
          lockedUntil,
          attempts: 1,
        });
        claimed = true;
      } catch (err: any) {
        if (err?.code === 11000) {
          const existing = await WebhookEventModel.findOne({ eventId });
          if (existing?.status === "PROCESSED") {
            return { received: true, duplicate: true, message: "Webhook event already processed" };
          }

          // Reclaim stale lease if previous worker crashed or lease expired
          const now = new Date();
          const reclaimed = await WebhookEventModel.findOneAndUpdate(
            {
              eventId,
              $or: [
                { status: { $ne: "PROCESSED" }, lockedUntil: { $lte: now } },
                { status: "FAILED" },
              ],
            },
            {
              $set: {
                status: "PROCESSING",
                leaseToken,
                lockedUntil,
              },
              $inc: { attempts: 1 },
            },
            { new: true },
          ).exec();

          if (!reclaimed) {
            return {
              received: true,
              inProgress: true,
              message: "Webhook event currently being processed by another worker",
            };
          }
          claimed = true;
        } else {
          throw err;
        }
      }
    }

    if (!claimed) {
      return { received: true };
    }

    try {
      // 1. payment.captured
      if (eventType === "payment.captured" && (providerOrderId || providerPaymentId)) {
        let payment = providerOrderId
          ? await this.paymentRepo.findOne({ providerOrderId }, false)
          : null;

        if (!payment && providerPaymentId) {
          payment = await this.paymentRepo.findOne({ providerPaymentId }, false);
        }

        if (payment && payment.status !== "SUCCESS" && payment.status !== "REFUNDED") {
          const bookingId = (payment.bookingId as any)?._id || payment.bookingId;
          const now = new Date();

          type WebhookTxResult = {
            confirmed: boolean;
            alreadyConfirmed: boolean;
            expired: boolean;
            confirmedAppointment: any;
          };

          const txResult: WebhookTxResult = await this.transactionManager.executeTransaction(
            async (session) => {
              const confirmedAppt = this.appointmentRepo.atomicConfirmPayment
                ? await this.appointmentRepo.atomicConfirmPayment(bookingId, now, session)
                : await this.appointmentRepo.updateStatus(bookingId, "confirmed");

              if (confirmedAppt) {
                if (this.paymentRepo.transitionToSuccess) {
                  await this.paymentRepo.transitionToSuccess(
                    payment._id,
                    providerPaymentId || entity.id,
                    session,
                  );
                } else {
                  await this.paymentRepo.updateStatus(payment._id, "SUCCESS", {
                    providerPaymentId: providerPaymentId || entity.id,
                    failureReason: null,
                  });
                }

                if (isDbConnected) {
                  const outboxEvent = new OutboxEventModel({
                    aggregateType: "APPOINTMENT",
                    aggregateId: String(bookingId),
                    eventType: "APPOINTMENT_CONFIRMED",
                    payload: {
                      appointmentId: String(bookingId),
                      patientId: String(payment.patientId),
                      amount: payment.amount,
                    },
                    status: "PENDING",
                  });
                  await outboxEvent.save({ session });
                }

                return {
                  confirmed: true,
                  alreadyConfirmed: false,
                  expired: false,
                  confirmedAppointment: confirmedAppt,
                };
              }

              // Check if already confirmed
              let existingAppt: any = null;
              if (isDbConnected) {
                existingAppt = await AppointmentModel.findById(bookingId).session(session).exec();
              } else {
                existingAppt = await this.appointmentRepo.findById(bookingId, false);
              }

              if (existingAppt && String(existingAppt.status).toLowerCase() === "confirmed") {
                if (this.paymentRepo.transitionToSuccess) {
                  await this.paymentRepo.transitionToSuccess(
                    payment._id,
                    providerPaymentId || entity.id,
                    session,
                  );
                } else {
                  await this.paymentRepo.updateStatus(payment._id, "SUCCESS", {
                    providerPaymentId: providerPaymentId || entity.id,
                    failureReason: null,
                  });
                }
                return {
                  confirmed: false,
                  alreadyConfirmed: true,
                  expired: false,
                  confirmedAppointment: existingAppt,
                };
              }

              return {
                confirmed: false,
                alreadyConfirmed: false,
                expired: true,
                confirmedAppointment: existingAppt,
              };
            },
          );

          if (txResult.confirmed && this.notificationService) {
            try {
              const updatedAppointment = await this.appointmentRepo.findById(bookingId, true);
              if (updatedAppointment) {
                await this.notificationService.sendAppointmentConfirmation(updatedAppointment);
              }
            } catch (notifErr) {
              console.warn("Failed to send confirmation on webhook:", notifErr);
            }
          }

          if (txResult.expired) {
            // Late payment captured for expired/cancelled appointment: initiate refund reconciliation
            console.warn(
              `[Payment Webhook] Late payment captured for expired booking ${bookingId}. Initiating refund reconciliation.`,
            );

            const idempotencyKey =
              payment.refundIdempotencyKey ||
              `rfnd_idem_${payment._id}_${providerOrderId || Date.now()}`;
            const refundPayload = {
              providerPaymentId: providerPaymentId || entity.id,
              amount: payment.amount,
              reason: "Late payment received after booking reservation expired (Webhook)",
            };

            const lockedPayment = await this.paymentRepo.acquireRefundLock(
              payment._id,
              idempotencyKey,
              refundPayload,
            );

            if (lockedPayment) {
              const refundResult = await this.paymentGateway.refundPayment({
                providerPaymentId: providerPaymentId || entity.id,
                amount: payment.amount,
                reason: "Late payment received after booking reservation expired (Webhook)",
                idempotencyKey,
              });

              if (refundResult.status === "processed" || refundResult.success) {
                await this.transactionManager.executeTransaction(async (session) => {
                  await this.paymentRepo.transitionToRefunded(
                    payment._id,
                    refundResult.refundId,
                    new Date(),
                    session,
                  );

                  if (isDbConnected) {
                    const refundOutbox = new OutboxEventModel({
                      aggregateType: "PAYMENT",
                      aggregateId: String(payment._id),
                      eventType: "PAYMENT_REFUNDED",
                      payload: {
                        paymentId: String(payment._id),
                        bookingId: String(bookingId),
                        patientId: String(payment.patientId),
                        amount: payment.amount,
                        currency: payment.currency || "INR",
                        refundId: refundResult.refundId,
                      },
                      status: "PENDING",
                    });
                    await refundOutbox.save({ session });
                  }
                });

                try {
                  await this.notificationRepo.create({
                    recipient: (payment.patientId as any)?._id || payment.patientId,
                    type: "payment_refunded",
                    title: "Payment Refunded - Booking Expired",
                    message: `Your payment of ₹${payment.amount} was received after the reservation timeout. A full refund has been initiated (Refund ID: ${refundResult.refundId}).`,
                    appointment: bookingId,
                  });
                } catch (nErr) {
                  console.warn("Failed to send refund notification on webhook:", nErr);
                }
              } else if (refundResult.status === "pending") {
                await this.paymentRepo.transitionToRefundPending(
                  payment._id,
                  refundResult.refundId,
                );
              } else {
                await this.paymentRepo.transitionToRefundFailed(
                  payment._id,
                  refundResult.failureReason || "Gateway refund failed",
                );
              }
            }
          }
        }
      }

      // 2. payment.failed
      if (eventType === "payment.failed" && (providerOrderId || providerPaymentId)) {
        const payment = providerOrderId
          ? await this.paymentRepo.findOne({ providerOrderId }, false)
          : await this.paymentRepo.findOne({ providerPaymentId }, false);

        // Terminal state protection: out-of-order failed events must NOT overwrite SUCCESS or REFUNDED
        if (payment && payment.status === "PENDING") {
          if (this.paymentRepo.transitionToFailed) {
            await this.paymentRepo.transitionToFailed(
              payment._id,
              entity.error_description || "Payment failed at gateway",
            );
          } else {
            await this.paymentRepo.updateStatus(payment._id, "FAILED", {
              failureReason: entity.error_description || "Payment failed at gateway",
            });
          }
        }
      }

      // 3. refund.processed
      if (eventType === "refund.processed" && (providerPaymentId || entity.id)) {
        const refundId = entity.id;
        const payment = await this.paymentRepo.findOne(
          {
            $or: [
              { refundId },
              { providerPaymentId: entity.payment_id },
            ],
          },
          false,
        );

        if (payment && payment.status !== "REFUNDED") {
          await this.paymentRepo.transitionToRefunded(payment._id, refundId, new Date());
        }
      }

      // 4. refund.failed
      if (eventType === "refund.failed" && (providerPaymentId || entity.id)) {
        const refundId = entity.id;
        const payment = await this.paymentRepo.findOne(
          {
            $or: [
              { refundId },
              { providerPaymentId: entity.payment_id },
            ],
          },
          false,
        );

        if (payment && payment.refundStatus !== "FAILED") {
          await this.paymentRepo.transitionToRefundFailed(
            payment._id,
            entity.error_description || "Gateway refund failed",
          );
        }
      }

      // Commit WebhookEvent to PROCESSED fenced by leaseToken
      if (isDbConnected) {
        await WebhookEventModel.findOneAndUpdate(
          { eventId, leaseToken },
          {
            $set: {
              status: "PROCESSED",
              processedAt: new Date(),
              lockedUntil: null,
            },
          },
        ).exec();
      }

      return { received: true, processed: true };
    } catch (err: any) {
      if (isDbConnected) {
        await WebhookEventModel.findOneAndUpdate(
          { eventId, leaseToken },
          {
            $set: {
              status: "FAILED",
              lastError: err?.message || String(err),
              lockedUntil: null,
            },
          },
        ).exec();
      }
      throw err;
    }
  }
}
