import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { PaymentService } from "../services/payment.service.js";
import { MockPaymentGateway } from "../infrastructure/payment/mock/MockPaymentGateway.js";
import { RazorpayGateway } from "../infrastructure/payment/razorpay/RazorpayGateway.js";
import { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";

// In-memory test repositories
class TestPaymentRepository implements IPaymentRepository {
  public payments: any[] = [];

  async create(data: any) {
    const payment = {
      _id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.payments.push(payment);
    return payment;
  }

  async findById(id: any) {
    return this.payments.find((p) => String(p._id) === String(id)) || null;
  }

  async findOne(filter: any) {
    return (
      this.payments.find((p) => {
        return Object.entries(filter).every(([k, v]) => String(p[k]) === String(v));
      }) || null
    );
  }

  async findByBookingId(bookingId: any) {
    return this.payments.filter((p) => String(p.bookingId) === String(bookingId));
  }

  async find(filter: any) {
    return this.payments.filter((p) => {
      return Object.entries(filter).every(([k, v]) => String(p[k]) === String(v));
    });
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
    const results = await this.find(filter);
    return results.length;
  }
}

class TestAppointmentRepository implements Partial<IAppointmentRepository> {
  public appointments: any[] = [];

  async findById(id: any) {
    return this.appointments.find((a) => String(a._id) === String(id)) || null;
  }

  async updateStatus(id: any, status: string) {
    const a = await this.findById(id);
    if (!a) return null;
    a.status = status;
    return a;
  }
}

class TestDoctorRepository implements Partial<IDoctorRepository> {
  public doctors: any[] = [];

  async findById(id: any) {
    return this.doctors.find((d) => String(d._id) === String(id)) || null;
  }
}

class TestNotificationRepository implements Partial<INotificationRepository> {
  public notifications: any[] = [];

  async create(data: any) {
    const notif = { _id: `notif_${Date.now()}`, ...data };
    this.notifications.push(notif);
    return notif;
  }
}

class TestUserRepository implements Partial<IUserRepository> {
  public users: any[] = [];

  async findById(id: any) {
    return this.users.find((u) => String(u._id) === String(id)) || null;
  }
}

describe("Payment Module & Gateway Tests", () => {
  let paymentRepo: TestPaymentRepository;
  let apptRepo: TestAppointmentRepository;
  let docRepo: TestDoctorRepository;
  let notifRepo: TestNotificationRepository;
  let userRepo: TestUserRepository;
  let mockGateway: MockPaymentGateway;
  let paymentService: PaymentService;

  const patientId = "patient_user_123";
  const otherPatientId = "patient_user_999";
  const doctorUserId = "doctor_user_456";
  const doctorId = "doctor_profile_789";
  const bookingId = "appointment_001";

  beforeEach(() => {
    paymentRepo = new TestPaymentRepository();
    apptRepo = new TestAppointmentRepository();
    docRepo = new TestDoctorRepository();
    notifRepo = new TestNotificationRepository();
    userRepo = new TestUserRepository();
    mockGateway = new MockPaymentGateway();

    paymentService = new PaymentService(
      paymentRepo as any,
      apptRepo as any,
      docRepo as any,
      notifRepo as any,
      userRepo as any,
      mockGateway,
    );

    userRepo.users.push({
      _id: patientId,
      name: "John Doe",
      email: "john@example.com",
      role: "patient",
    });

    userRepo.users.push({
      _id: doctorUserId,
      name: "Dr. Smith",
      email: "smith@hospital.org",
      role: "doctor",
    });

    docRepo.doctors.push({
      _id: doctorId,
      user: doctorUserId,
      consultationFee: 750,
      specialization: "Cardiology",
    });

    apptRepo.appointments.push({
      _id: bookingId,
      patient: patientId,
      doctor: {
        _id: doctorId,
        user: { _id: doctorUserId, name: "Dr. Smith" },
        consultationFee: 750,
      },
      appointmentDate: new Date("2026-10-15T10:00:00.000Z"),
      timeSlot: "10:00 AM",
      status: "pending_payment",
    });
  });

  it("1. should create a payment order for an appointment with doctor consultation fee", async () => {
    const result = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    assert.ok(result.payment);
    assert.equal(result.payment.amount, 750);
    assert.equal(result.payment.currency, "INR");
    assert.equal(result.payment.status, "PENDING");
    assert.equal(result.payment.provider, "MOCK");
    assert.ok(result.order.providerOrderId.startsWith("order_mock_"));
    assert.equal(result.order.amount, 750);
  });

  it("2. should successfully verify mock payment and confirm the appointment", async () => {
    const orderResult = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    const verifyResult = await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: orderResult.payment._id,
      providerOrderId: orderResult.order.providerOrderId,
      simulateStatus: "SUCCESS",
    });

    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.payment.status, "SUCCESS");
    assert.ok(verifyResult.payment.providerPaymentId.startsWith("pay_mock_"));

    // Check appointment confirmed
    const updatedAppt = await apptRepo.findById(bookingId);
    assert.equal(updatedAppt.status, "confirmed");

    // Check notifications generated for both patient and doctor
    assert.equal(notifRepo.notifications.length, 2);
  });

  it("3. should handle failed mock payment without confirming the appointment", async () => {
    const orderResult = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    const verifyResult = await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: orderResult.payment._id,
      providerOrderId: orderResult.order.providerOrderId,
      simulateStatus: "FAILED",
      failureReason: "Insufficient funds in bank account",
    });

    assert.equal(verifyResult.success, false);
    assert.equal(verifyResult.payment.status, "FAILED");
    assert.equal(verifyResult.payment.failureReason, "Insufficient funds in bank account");

    // Appointment must remain pending_payment (unconfirmed)
    const appt = await apptRepo.findById(bookingId);
    assert.equal(appt.status, "pending_payment");
    assert.notEqual(appt.status, "confirmed");
  });

  it("4. should retry a failed payment by creating a fresh order while preserving historical failure", async () => {
    // Step A: Create order & fail it
    const initialOrder = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: initialOrder.payment._id,
      providerOrderId: initialOrder.order.providerOrderId,
      simulateStatus: "FAILED",
      failureReason: "Bank timeout",
    });

    // Verify initial payment is marked FAILED
    const failedPayment = await paymentRepo.findById(initialOrder.payment._id);
    assert.equal(failedPayment.status, "FAILED");

    // Step B: Retry payment
    const retryResult = await paymentService.retryPayment({
      patientUserId: patientId,
      paymentId: initialOrder.payment._id,
    });

    assert.equal(retryResult.success, true);
    assert.notEqual(retryResult.payment._id, initialOrder.payment._id);
    assert.equal(retryResult.payment.status, "PENDING");

    // Original payment record remains untouched in history
    const originalRecord = await paymentRepo.findById(initialOrder.payment._id);
    assert.equal(originalRecord.status, "FAILED");
    assert.equal(originalRecord.failureReason, "Bank timeout");

    // Database now contains 2 payment records for this booking
    const allForBooking = await paymentRepo.findByBookingId(bookingId);
    assert.equal(allForBooking.length, 2);
  });

  it("5. should prevent unauthorized payment access (patient isolation)", async () => {
    const orderResult = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    // Patient B attempts to verify Patient A's payment
    await assert.rejects(
      async () => {
        await paymentService.verifyPayment({
          patientUserId: otherPatientId,
          paymentId: orderResult.payment._id,
          simulateStatus: "SUCCESS",
        });
      },
      { message: "Unauthorized to verify this payment transaction" },
    );

    // Patient B attempts to get Patient A's payment by ID
    await assert.rejects(
      async () => {
        await paymentService.getPaymentById({
          patientUserId: otherPatientId,
          role: "patient",
          paymentId: orderResult.payment._id,
        });
      },
      { message: "You are not authorized to view this payment" },
    );
  });

  it("6. should ensure idempotent payment verification (no duplicate confirmation)", async () => {
    const orderResult = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    // First verification: SUCCESS
    const firstVerify = await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: orderResult.payment._id,
      simulateStatus: "SUCCESS",
    });
    assert.equal(firstVerify.success, true);

    const initialNotifCount = notifRepo.notifications.length;

    // Second verification call (duplicate): should return idempotently without duplicate notifications
    const secondVerify = await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: orderResult.payment._id,
      simulateStatus: "SUCCESS",
    });

    assert.equal(secondVerify.success, true);
    assert.equal(secondVerify.payment.status, "SUCCESS");
    assert.equal(notifRepo.notifications.length, initialNotifCount);
  });

  it("7. should reject creating a payment order if appointment is already paid", async () => {
    const orderResult = await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    await paymentService.verifyPayment({
      patientUserId: patientId,
      paymentId: orderResult.payment._id,
      simulateStatus: "SUCCESS",
    });

    // Attempting to create another payment order for the confirmed appointment must fail
    await assert.rejects(
      async () => {
        await paymentService.createPaymentOrder({
          patientUserId: patientId,
          bookingId,
        });
      },
      { message: "This appointment is already paid and confirmed" },
    );
  });

  it("8. should fetch patient payment history with isolation", async () => {
    await paymentService.createPaymentOrder({
      patientUserId: patientId,
      bookingId,
    });

    const history = await paymentService.getPaymentHistory({
      patientUserId: patientId,
      role: "patient",
    });

    assert.equal(history.payments.length, 1);
    assert.equal(history.total, 1);

    // Other patient should see 0 payments
    const otherHistory = await paymentService.getPaymentHistory({
      patientUserId: otherPatientId,
      role: "patient",
    });
    assert.equal(otherHistory.payments.length, 0);
  });

  it("9. should verify RazorpayGateway architecture with HMAC SHA256 signatures", async () => {
    const keySecret = "test_secret_key_12345";
    const razorpayGateway = new RazorpayGateway("test_sandbox_key", keySecret);

    const order = await razorpayGateway.createOrder({
      amount: 1000,
      currency: "INR",
      receipt: "rcpt_test",
    });

    assert.ok(order.providerOrderId.startsWith("order_rzp_"));
    assert.equal(order.provider, "RAZORPAY");

    // Valid signature
    const crypto = await import("crypto");
    const validPaymentId = "pay_rzp_test_123";
    const validSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${order.providerOrderId}|${validPaymentId}`)
      .digest("hex");

    const validVerification = await razorpayGateway.verifyPayment({
      providerOrderId: order.providerOrderId,
      providerPaymentId: validPaymentId,
      razorpaySignature: validSignature,
    });
    assert.equal(validVerification.success, true);

    // Invalid signature
    const invalidVerification = await razorpayGateway.verifyPayment({
      providerOrderId: order.providerOrderId,
      providerPaymentId: validPaymentId,
      razorpaySignature: "invalid_tampered_signature",
    });
    assert.equal(invalidVerification.success, false);
    assert.equal(invalidVerification.failureReason, "Razorpay server-side signature verification failed");
  });
});
