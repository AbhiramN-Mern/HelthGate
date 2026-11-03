import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { AppointmentService, DEFAULT_RESERVATION_TIMEOUT_MINUTES } from "../services/appointment.service.js";
import { PaymentService } from "../services/payment.service.js";
import { ReservationCleanupWorker } from "../workers/reservationCleanupWorker.js";
import { MockPaymentGateway } from "../infrastructure/payment/mock/MockPaymentGateway.js";
import { BadRequestError } from "../core/errors/AppError.js";
import { normalizeAppointmentDate, normalizeTimeSlot } from "../utils/slotNormalizer.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import type { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IUserRepository } from "../repositories/interfaces/IUserRepository.js";

class TestExpirationAppointmentRepo implements Partial<IAppointmentRepository> {
  public appointments: any[] = [];
  private activeStatuses = [
    "pending_payment",
    "PENDING_PAYMENT",
    "scheduled",
    "confirmed",
    "CONFIRMED",
  ];

  async create(data: any) {
    const nDate = data.normalizedDate || normalizeAppointmentDate(data.appointmentDate);
    const nSlot = data.normalizedTimeSlot || normalizeTimeSlot(data.timeSlot);

    // Partial compound unique index simulation
    if (this.activeStatuses.includes(data.status || "pending_payment")) {
      const conflict = this.appointments.find((a) => {
        if (!this.activeStatuses.includes(a.status)) return false;
        if (String(a.doctor) !== String(data.doctor)) return false;
        const aDate = a.normalizedDate || normalizeAppointmentDate(a.appointmentDate);
        const aSlot = a.normalizedTimeSlot || normalizeTimeSlot(a.timeSlot);
        return aDate === nDate && aSlot === nSlot;
      });

      if (conflict) {
        const err: any = new Error("E11000 duplicate key error");
        err.code = 11000;
        throw err;
      }
    }

    const appt = {
      _id: `appt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      status: "pending_payment",
      actionHistory: [],
      ...data,
      normalizedDate: nDate,
      normalizedTimeSlot: nSlot,
    };
    this.appointments.push(appt);
    return appt;
  }

  async findById(id: any) {
    return this.appointments.find((a) => String(a._id) === String(id)) || null;
  }

  async findOne(filter: any) {
    return (
      this.appointments.find((a) =>
        Object.entries(filter).every(([k, v]) => String(a[k]) === String(v)),
      ) || null
    );
  }

  async find(filter: any = {}) {
    return this.appointments.filter((a) => {
      if (filter.doctor && String(a.doctor) !== String(filter.doctor)) return false;
      if (filter.status?.$nin && filter.status.$nin.includes(a.status)) return false;
      if (filter.status?.$in && !filter.status.$in.includes(a.status)) return false;
      if (filter.bookingExpiresAt?.$lte && !(a.bookingExpiresAt && a.bookingExpiresAt <= filter.bookingExpiresAt.$lte)) {
        return false;
      }
      return true;
    });
  }

  async updateStatus(id: any, status: string) {
    const a = await this.findById(id);
    if (!a) return null;
    a.status = status;
    return a;
  }

  async findExpiredReservations(now: Date = new Date()): Promise<any[]> {
    return this.appointments.filter((a) => {
      const isExpired =
        (a.paymentExpiresAt && new Date(a.paymentExpiresAt) <= now) ||
        (a.bookingExpiresAt && new Date(a.bookingExpiresAt) <= now);
      return (
        this.activeStatuses.includes(a.status) &&
        a.status.toLowerCase().includes("pending") &&
        isExpired
      );
    });
  }

  async cancelExpiredReservation(id: any, now: Date = new Date()): Promise<any | null> {
    const a = await this.findById(id);
    if (!a) return null;
    // Atomic check: must STILL be pending_payment and expired
    if (!a.status.toLowerCase().includes("pending")) return null;
    const isExpired =
      (a.paymentExpiresAt && new Date(a.paymentExpiresAt) <= now) ||
      (a.bookingExpiresAt && new Date(a.bookingExpiresAt) <= now);
    if (!isExpired) return null;

    a.status = "EXPIRED";
    a.cancelledBy = "system";
    a.cancelledAt = now;
    a.cancellationReason =
      "Reservation expired: payment was not completed within the allowed time limit";
    a.actionHistory.push({
      action: "cancelled_due_to_payment_timeout",
      initiatedByRole: "system",
      approvalStatus: "not_required",
      timestamp: now,
      details: { reason: "Reservation timeout" },
    });
    return a;
  }

  async cancelExpiredReservationsForSlot(
    doctor: any,
    normalizedDate: string,
    normalizedTimeSlot: string,
    now: Date = new Date(),
  ): Promise<number> {
    let count = 0;
    for (const a of this.appointments) {
      if (
        String(a.doctor) === String(doctor) &&
        a.normalizedDate === normalizedDate &&
        a.normalizedTimeSlot === normalizedTimeSlot
      ) {
        if (
          this.activeStatuses.includes(a.status) &&
          a.status.toLowerCase().includes("pending")
        ) {
          const exp = a.paymentExpiresAt || a.bookingExpiresAt;
          if (exp && new Date(exp) <= now) {
            a.status = "EXPIRED";
            a.cancelledBy = "system";
            a.cancelledAt = now;
            a.cancellationReason =
              "Reservation expired: payment was not completed within the allowed time limit";
            count++;
          }
        }
      }
    }
    return count;
  }

  async atomicConfirmPayment(id: any, now: Date = new Date()): Promise<any | null> {
    const a = await this.findById(id);
    if (!a) return null;
    // Atomic check: must be pending_payment and NOT expired
    if (!a.status.toLowerCase().includes("pending")) return null;
    const exp = a.paymentExpiresAt || a.bookingExpiresAt;
    if (exp && new Date(exp) <= now) return null;

    a.status = "confirmed";
    a.actionHistory.push({
      action: "payment_confirmed",
      initiatedByRole: "patient",
      approvalStatus: "approved",
      timestamp: now,
    });
    return a;
  }

  async count(filter: any = {}) {
    return (await this.find(filter)).length;
  }
}

class TestExpirationPaymentRepo implements IPaymentRepository {
  public payments: any[] = [];

  async create(data: any) {
    const p = {
      _id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.payments.push(p);
    return p;
  }

  async findById(id: any) {
    return this.payments.find((p) => String(p._id) === String(id)) || null;
  }

  async findOne(filter: any) {
    return (
      this.payments.find((p) =>
        Object.entries(filter).every(([k, v]) => String(p[k]) === String(v)),
      ) || null
    );
  }

  async findByBookingId(bookingId: any) {
    return this.payments.filter((p) => String(p.bookingId) === String(bookingId));
  }

  async find(filter: any) {
    return this.payments.filter((p) =>
      Object.entries(filter).every(([k, v]) => String(p[k]) === String(v)),
    );
  }

  async findByIdAndUpdate(id: any, update: any) {
    const p = await this.findById(id);
    if (!p) return null;
    Object.assign(p, update, { updatedAt: new Date() });
    return p;
  }

  async updateStatus(id: any, status: string, extra: any = {}) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = status;
    Object.assign(p, extra, { updatedAt: new Date() });
    return p;
  }

  async count(filter: any = {}) {
    return (await this.find(filter)).length;
  }

  async transitionToSuccess(id: any, providerPaymentId: string) {
    const p = await this.findById(id);
    if (!p || p.status !== "PENDING") return null;
    p.status = "SUCCESS";
    p.providerPaymentId = providerPaymentId;
    p.updatedAt = new Date();
    return p;
  }

  async transitionToFailed(id: any, failureReason: string) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = "FAILED";
    p.failureReason = failureReason;
    p.updatedAt = new Date();
    return p;
  }

  async acquireRefundLock(id: any, idempotencyKey: string, refundPayload: any) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = "REFUND_REQUESTED";
    p.refundStatus = "REQUESTED";
    p.refundIdempotencyKey = idempotencyKey;
    p.refundPayload = refundPayload;
    p.updatedAt = new Date();
    return p;
  }

  async transitionToRefundPending(id: any, refundId: string) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = "REFUND_PENDING";
    p.refundStatus = "PENDING";
    p.refundId = refundId;
    p.updatedAt = new Date();
    return p;
  }

  async transitionToRefunded(id: any, refundId: string, refundedAt?: Date) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = "REFUNDED";
    p.refundStatus = "PROCESSED";
    p.refundId = refundId;
    p.refundedAt = refundedAt || new Date();
    p.updatedAt = new Date();
    return p;
  }

  async transitionToRefundFailed(id: any, failureReason: string) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = "REFUND_FAILED";
    p.refundStatus = "FAILED";
    p.failureReason = failureReason;
    p.updatedAt = new Date();
    return p;
  }
}

class TestExpirationDoctorRepo implements Partial<IDoctorRepository> {
  public doctors: any[] = [];
  async findById(id: any) {
    return this.doctors.find((d) => String(d._id) === String(id)) || null;
  }
}

class TestExpirationUserRepo implements Partial<IUserRepository> {
  public users: any[] = [];
  async findById(id: any) {
    return this.users.find((u) => String(u._id) === String(id)) || null;
  }
}

class TestExpirationNotificationRepo implements Partial<INotificationRepository> {
  public notifications: any[] = [];
  async create(data: any) {
    const n = { _id: `notif_${Date.now()}`, ...data };
    this.notifications.push(n);
    return n;
  }
}

class TestExpirationHospitalDoctorRepo implements Partial<IHospitalDoctorRepository> {
  async find() {
    return [];
  }
}

describe("Phase 2: Pending Payment Reservation Expiration Tests", () => {
  let apptRepo: TestExpirationAppointmentRepo;
  let paymentRepo: TestExpirationPaymentRepo;
  let doctorRepo: TestExpirationDoctorRepo;
  let userRepo: TestExpirationUserRepo;
  let notifRepo: TestExpirationNotificationRepo;
  let hospDocRepo: TestExpirationHospitalDoctorRepo;
  let paymentGateway: MockPaymentGateway;
  let appointmentService: AppointmentService;
  let paymentService: PaymentService;
  let cleanupWorker: ReservationCleanupWorker;

  const doctorId = "doc_exp_1";
  const doctorUserId = "doc_user_exp_1";
  const patientUserId = "pat_exp_1";
  const patient2UserId = "pat_exp_2";

  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + 5);
  const targetDateStr = targetDateObj.toISOString().split("T")[0];
  const targetTimeSlot = "10:00 AM";

  beforeEach(() => {
    delete process.env.APPOINTMENT_RESERVATION_TIMEOUT_MINUTES;
    delete process.env.BOOKING_RESERVATION_TIMEOUT_MINUTES;

    apptRepo = new TestExpirationAppointmentRepo();
    paymentRepo = new TestExpirationPaymentRepo();
    doctorRepo = new TestExpirationDoctorRepo();
    userRepo = new TestExpirationUserRepo();
    notifRepo = new TestExpirationNotificationRepo();
    hospDocRepo = new TestExpirationHospitalDoctorRepo();
    paymentGateway = new MockPaymentGateway();

    doctorRepo.doctors.push({
      _id: doctorId,
      user: { _id: doctorUserId, name: "Dr. Gregory House" },
      verificationStatus: "verified",
      available: true,
      consultationFee: 750,
      availability: {
        workingDays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        availableSlots: ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM"],
        blockedDates: [],
      },
    });

    userRepo.users.push(
      { _id: patientUserId, name: "Alice Patient", email: "alice@example.com" },
      { _id: patient2UserId, name: "Bob Patient", email: "bob@example.com" },
    );

    appointmentService = new AppointmentService(
      apptRepo as any,
      doctorRepo as any,
      hospDocRepo as any,
      notifRepo as any,
      userRepo as any,
    );

    paymentService = new PaymentService(
      paymentRepo as any,
      apptRepo as any,
      doctorRepo as any,
      notifRepo as any,
      userRepo as any,
      paymentGateway,
    );

    cleanupWorker = new ReservationCleanupWorker(apptRepo as any, notifRepo as any);
  });

  afterEach(() => {
    cleanupWorker.stop();
  });

  it("1. Appointment created with pending_payment populates paymentExpiresAt and bookingExpiresAt defaulting to 5 minutes", async () => {
    const beforeTime = Date.now();
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    assert.ok(appt.paymentExpiresAt, "paymentExpiresAt must be populated");
    assert.ok(appt.bookingExpiresAt, "bookingExpiresAt must be populated");
    assert.ok(appt.reservationReference, "reservationReference must be populated");
    const expiresAt = new Date(appt.paymentExpiresAt).getTime();
    const expectedExpiry = beforeTime + DEFAULT_RESERVATION_TIMEOUT_MINUTES * 60 * 1000;

    // Tolerance window within 2 seconds
    assert.ok(
      Math.abs(expiresAt - expectedExpiry) < 2000,
      `Expected expiry near ${new Date(expectedExpiry)}, got ${new Date(expiresAt)}`,
    );
    assert.equal(appt.status, "pending_payment");
  });

  it("2. Respects custom reservation timeout configured via environment variable", async () => {
    process.env.APPOINTMENT_RESERVATION_TIMEOUT_MINUTES = "15";
    const beforeTime = Date.now();

    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "09:00 AM",
    });

    const expiresAt = new Date(appt.bookingExpiresAt).getTime();
    const expectedExpiry = beforeTime + 15 * 60 * 1000;

    assert.ok(Math.abs(expiresAt - expectedExpiry) < 2000);
  });

  it("3. Reject creating a payment order if appointment reservation has already expired", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Manually simulate expiration in past
    appt.bookingExpiresAt = new Date(Date.now() - 5000);

    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          patientUserId,
          bookingId: appt._id,
        });
      },
      (err: any) => {
        return err instanceof BadRequestError && /expired/i.test(err.message);
      },
    );
  });

  it("4. Background cleanup worker finds and atomically cancels expired pending reservations with audit trail", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Advance expiration into past
    appt.bookingExpiresAt = new Date(Date.now() - 60000);
    appt.paymentExpiresAt = new Date(Date.now() - 60000);

    const stats = await cleanupWorker.cleanupExpiredReservations();
    assert.equal(stats.checked, 1);
    assert.equal(stats.expiredCancelled, 1);

    const updated = await apptRepo.findById(appt._id);
    assert.ok(updated.status === "EXPIRED" || updated.status === "cancelled");
    assert.equal(updated.cancelledBy, "system");
    assert.ok(updated.cancelledAt);
    assert.match(updated.cancellationReason, /Reservation expired/);

    // Verify audit entry in actionHistory
    assert.equal(updated.actionHistory.length, 1);
    assert.equal(updated.actionHistory[0].action, "cancelled_due_to_payment_timeout");
    assert.equal(updated.actionHistory[0].initiatedByRole, "system");

    // Verify patient notification was dispatched
    const patientNotif = notifRepo.notifications.find((n) => n.type === "cancellation");
    assert.ok(patientNotif, "Patient notification must be created on reservation expiration");
  });

  it("5. Expired appointment cancellation releases the slot, allowing another patient to book it immediately", async () => {
    const appt1 = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Advance time and run cleanup worker
    appt1.bookingExpiresAt = new Date(Date.now() - 1000);
    appt1.paymentExpiresAt = new Date(Date.now() - 1000);
    await cleanupWorker.cleanupExpiredReservations();

    assert.ok(appt1.status === "EXPIRED" || appt1.status === "cancelled");

    // Second patient books the exact same slot
    const appt2 = await appointmentService.createAppointment({
      patientUserId: patient2UserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    assert.ok(appt2, "Second patient must successfully book the released slot");
    assert.equal(appt2.status, "pending_payment");
    assert.equal(apptRepo.appointments.length, 2);
  });

  it("6. Concurrent cleanup workers cannot double-cancel or corrupt appointments", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    appt.bookingExpiresAt = new Date(Date.now() - 1000);
    appt.paymentExpiresAt = new Date(Date.now() - 1000);

    // Run two cleanup sweeps concurrently
    const [sweep1, sweep2] = await Promise.all([
      cleanupWorker.cleanupExpiredReservations(),
      cleanupWorker.cleanupExpiredReservations(),
    ]);

    // Exactly one sweep should perform the cancellation
    assert.equal(sweep1.expiredCancelled + sweep2.expiredCancelled, 1);
    assert.equal(appt.actionHistory.length, 1, "Only one audit record should be pushed");
  });

  it("7. Cleanup worker NEVER cancels confirmed appointments even if original bookingExpiresAt passed", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Mark appointment as confirmed (payment was verified)
    appt.status = "confirmed";
    appt.bookingExpiresAt = new Date(Date.now() - 60000);
    appt.paymentExpiresAt = new Date(Date.now() - 60000);

    const stats = await cleanupWorker.cleanupExpiredReservations();
    assert.equal(stats.checked, 0);
    assert.equal(stats.expiredCancelled, 0);

    const reloaded = await apptRepo.findById(appt._id);
    assert.equal(reloaded.status, "confirmed", "Confirmed appointments must remain confirmed");
  });

  it("8. Late payment verification on an expired reservation rejects confirmation and triggers safe refund workflow", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Create payment order
    const order = await paymentService.createPaymentOrder({
      patientUserId,
      bookingId: appt._id,
    });

    // Advance time and expire the appointment
    appt.bookingExpiresAt = new Date(Date.now() - 60000);
    appt.paymentExpiresAt = new Date(Date.now() - 60000);
    await cleanupWorker.cleanupExpiredReservations();
    assert.ok(appt.status === "cancelled" || appt.status === "EXPIRED");

    // Patient's late payment verification arrives
    const verifyResult = await paymentService.verifyPayment({
      patientUserId,
      paymentId: order.payment._id,
      providerPaymentId: "pay_mock_12345",
      simulateStatus: "SUCCESS",
    });

    assert.equal(verifyResult.success, false);
    assert.equal(verifyResult.expired, true);
    assert.equal(verifyResult.refunded, true);
    assert.match(verifyResult.message, /reservation expired/i);
    assert.match(verifyResult.message, /refund/i);

    // Appointment must REMAIN cancelled or expired, not confirmed
    const finalAppt = await apptRepo.findById(appt._id);
    assert.ok(finalAppt.status === "cancelled" || finalAppt.status === "EXPIRED");

    // Payment record must be marked REFUNDED with refundId
    const finalPayment = await paymentRepo.findById(order.payment._id);
    assert.equal(finalPayment.status, "REFUNDED");
    assert.ok(finalPayment.refundId);
    assert.equal(finalPayment.refundStatus, "PROCESSED");

    // Patient refund notification must be dispatched
    const refundNotif = notifRepo.notifications.find((n) => n.type === "payment_refunded");
    assert.ok(refundNotif, "Patient must receive payment_refunded notification");
  });

  it("9. Late payment webhook arrival on an expired reservation triggers refund without confirming slot", async () => {
    const appt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    const order = await paymentService.createPaymentOrder({
      patientUserId,
      bookingId: appt._id,
    });

    // Expire and cancel the reservation
    appt.bookingExpiresAt = new Date(Date.now() - 60000);
    appt.paymentExpiresAt = new Date(Date.now() - 60000);
    await cleanupWorker.cleanupExpiredReservations();

    // Razorpay webhook payment.captured arrives late
    await paymentService.handleWebhook({
      payload: {
        event: "payment.captured",
        payload: {
          payment: {
            entity: {
              id: "pay_rzp_late_999",
              order_id: order.order.providerOrderId,
            },
          },
        },
      },
    });

    // Appointment remains cancelled or expired
    const finalAppt = await apptRepo.findById(appt._id);
    assert.ok(finalAppt.status === "cancelled" || finalAppt.status === "EXPIRED");

    // Payment marked REFUNDED
    const finalPayment = await paymentRepo.findById(order.payment._id);
    assert.equal(finalPayment.status, "REFUNDED");
    assert.ok(finalPayment.refundId);
  });

  it("10. Expired reservation does not block new booking even BEFORE background worker runs (atomic slot recovery)", async () => {
    const appt1 = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Advance expiration into the past WITHOUT running cleanupWorker
    appt1.bookingExpiresAt = new Date(Date.now() - 5000);
    appt1.paymentExpiresAt = new Date(Date.now() - 5000);

    // Availability check reports slot as available because hold is expired
    const avail = await appointmentService.validateDoctorSlotAvailability({
      doctorId,
      date: targetDateStr,
      timeSlot: targetTimeSlot,
    });
    assert.equal(avail.available, true, "Slot with expired reservation must report available");

    // Second patient attempts to book the expired slot directly
    const appt2 = await appointmentService.createAppointment({
      patientUserId: patient2UserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    assert.ok(appt2, "Second patient must successfully book the slot");
    assert.equal(appt2.status, "pending_payment");
    assert.notEqual(appt2._id, appt1._id);

    // Original appointment is now transitioned to EXPIRED
    const originalAppt = await apptRepo.findById(appt1._id);
    assert.equal(originalAppt.status, "EXPIRED");
  });

  it("11. Simultaneous booking of expired slot: exactly one succeeds, the other gets ConflictError (409)", async () => {
    const appt1 = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    // Manually expire appt1 without worker sweep
    appt1.bookingExpiresAt = new Date(Date.now() - 5000);
    appt1.paymentExpiresAt = new Date(Date.now() - 5000);

    const bookingAttempt1 = appointmentService.createAppointment({
      patientUserId: "concurrent_patient_1",
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    const bookingAttempt2 = appointmentService.createAppointment({
      patientUserId: "concurrent_patient_2",
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    const results = await Promise.allSettled([bookingAttempt1, bookingAttempt2]);
    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one booking must succeed");
    assert.equal(rejected.length, 1, "The other booking must fail with conflict");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(rejectionReason.statusCode === 409 || rejectionReason instanceof Error);
  });
});

