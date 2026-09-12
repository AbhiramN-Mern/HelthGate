import type { Types } from "mongoose";
import { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPaymentGateway, VerifyPaymentParams } from "../infrastructure/payment/IPaymentGateway.js";
import { NotificationService } from "./notification.service.js";
import {
  BadRequestError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors/AppError.js";
import { createPaginatedResponse } from "../utils/pagination.js";

export const DEFAULT_CONSULTATION_FEE = 500;

export class PaymentService {
  constructor(
    private paymentRepo: IPaymentRepository,
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private notificationRepo: INotificationRepository,
    private userRepo: IUserRepository,
    private paymentGateway: IPaymentGateway,
    private notificationService?: NotificationService,
  ) {}

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

    if (appointment.status === "cancelled") {
      throw new BadRequestError("Cannot make payment for a cancelled appointment");
    }

    if (appointment.status === "completed") {
      throw new BadRequestError("This appointment has already been completed");
    }

    // Check if an existing payment is already SUCCESS
    const existingPayments = await this.paymentRepo.findByBookingId(bookingId, false);
    const hasSuccessfulPayment = existingPayments.some(
      (p) => p.status === "SUCCESS",
    );
    if (hasSuccessfulPayment || String(appointment.status).toLowerCase() === "confirmed") {
      throw new ConflictError("This appointment is already paid and confirmed");
    }

    // Determine consultation fee
    let fee = DEFAULT_CONSULTATION_FEE;
    const doctorObj = appointment.doctor;
    if (doctorObj && typeof doctorObj.consultationFee === "number" && doctorObj.consultationFee > 0) {
      fee = doctorObj.consultationFee;
    } else if (doctorObj?._id) {
      const docDoc = await this.doctorRepo.findById(doctorObj._id, false);
      if (docDoc && typeof docDoc.consultationFee === "number" && docDoc.consultationFee > 0) {
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
    });

    return {
      payment,
      order: orderResult,
      appointment,
    };
  }

  /**
   * Server-side payment verification (Idempotent & Secure)
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

    // Idempotency: If already marked SUCCESS, return existing record
    if (payment.status === "SUCCESS") {
      return {
        success: true,
        message: "Payment was already verified successfully",
        payment,
        appointment: payment.bookingId,
      };
    }

    // Verify using the configured payment gateway
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
      // 1. Mark payment SUCCESS
      const updatedPayment = await this.paymentRepo.updateStatus(
        payment._id,
        "SUCCESS",
        {
          providerPaymentId: result.providerPaymentId,
          failureReason: null,
        },
      );

      // 2. Confirm the related appointment
      const bookingId = (payment.bookingId as any)?._id || payment.bookingId;
      await this.appointmentRepo.updateStatus(bookingId, "confirmed");
      const updatedAppointment = await this.appointmentRepo.findById(bookingId, true);

      // 3. Send notifications (Patient & Doctor)
      try {
        if (this.notificationService) {
          await this.notificationService.sendAppointmentConfirmation(updatedAppointment);
        } else {
          const patientUser = await this.userRepo.findById(patientUserId);
          const doctorUserId = (updatedAppointment?.doctor as any)?.user?._id || (updatedAppointment?.doctor as any)?.user;

          // Notification to patient
          await this.notificationRepo.create({
            recipient: patientUserId as any,
            type: "payment_success",
            title: "Payment Confirmed",
            message: `Your payment of ₹${payment.amount} for appointment on ${
              updatedAppointment?.appointmentDate
                ? new Date(updatedAppointment.appointmentDate).toLocaleDateString()
                : ""
            } was successful. Your appointment is now confirmed.`,
            appointment: bookingId,
          });

          // Notification to doctor
          if (doctorUserId) {
            await this.notificationRepo.create({
              recipient: doctorUserId as any,
              type: "appointment_confirmed",
              title: "Appointment Confirmed & Paid",
              message: `Patient ${patientUser?.name || ""} confirmed appointment on ${
                updatedAppointment?.appointmentDate
                  ? new Date(updatedAppointment.appointmentDate).toLocaleDateString()
                  : ""
              } (₹${payment.amount} paid).`,
              appointment: bookingId,
            });
          }
        }
      } catch (notifErr) {
        console.warn("Failed to send payment confirmation notification:", notifErr);
      }

      return {
        success: true,
        message: "Payment verified successfully and appointment confirmed",
        payment: updatedPayment,
        appointment: updatedAppointment,
      };
    } else {
      // Payment Failed: Mark payment FAILED, do NOT confirm appointment
      const updatedPayment = await this.paymentRepo.updateStatus(
        payment._id,
        "FAILED",
        {
          failureReason: result.failureReason || "Payment failed or was declined",
        },
      );

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

    if (appointment.status === "cancelled" || appointment.status === "completed") {
      throw new BadRequestError(`Cannot pay for an appointment that is already ${appointment.status}`);
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
   * Process asynchronous webhook from payment gateway
   */
  async handleWebhook(data: {
    signature?: string;
    payload: any;
  }) {
    const { payload } = data;

    // Razorpay webhook handling
    if (payload?.event === "payment.captured" && payload?.payload?.payment?.entity) {
      const entity = payload.payload.payment.entity;
      const providerOrderId = entity.order_id;
      const providerPaymentId = entity.id;

      if (providerOrderId) {
        const payment = await this.paymentRepo.findOne({ providerOrderId }, false);
        if (payment && payment.status !== "SUCCESS") {
          await this.paymentRepo.updateStatus(payment._id, "SUCCESS", {
            providerPaymentId,
            failureReason: null,
          });

          const bookingId = (payment.bookingId as any)?._id || payment.bookingId;
          await this.appointmentRepo.updateStatus(bookingId, "confirmed");
          if (this.notificationService) {
            try {
              const updatedAppointment = await this.appointmentRepo.findById(bookingId, true);
              if (updatedAppointment) {
                await this.notificationService.sendAppointmentConfirmation(updatedAppointment);
              }
            } catch (notifErr) {
              console.warn("Failed to send confirmation on webhook:", notifErr);
            }
          }
        }
      }
    }

    return { received: true };
  }
}
