import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { NotificationService } from "../services/notification.service.js";
import { MockEmailService } from "../infrastructure/email/MockEmailService.js";
import { DoctorService } from "../services/doctor.service.js";
import { AppointmentService } from "../services/appointment.service.js";
import { PaymentService } from "../services/payment.service.js";
import { MockPaymentGateway } from "../infrastructure/payment/mock/MockPaymentGateway.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import type { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import type { IPatientRepository } from "../repositories/interfaces/IPatientRepository.js";
import type { IHospitalRepository } from "../repositories/interfaces/IHospitalRepository.js";
import type { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import type { IPaymentRepository } from "../repositories/interfaces/IPaymentRepository.js";

// In-memory test repositories
class TestNotificationRepository implements Partial<INotificationRepository> {
  public notifications: any[] = [];

  async create(data: any) {
    const notif = { _id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, ...data };
    this.notifications.push(notif);
    return notif;
  }

  async findByRecipient(recipientId: any) {
    return this.notifications.filter((n) => String(n.recipient) === String(recipientId));
  }
}

class TestAppointmentRepository implements Partial<IAppointmentRepository> {
  public appointments: any[] = [];

  async create(data: any) {
    const appt = {
      _id: `appt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      status: "pending_payment",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.appointments.push(appt);
    return appt;
  }

  async findById(id: any) {
    return this.appointments.find((a) => String(a._id) === String(id)) || null;
  }

  async findOne(filter: any) {
    return (
      this.appointments.find((a) => {
        return Object.entries(filter).every(([k, v]) => String(a[k]) === String(v));
      }) || null
    );
  }

  async updateStatus(id: any, status: string) {
    const a = await this.findById(id);
    if (!a) return null;
    a.status = status;
    a.updatedAt = new Date();
    return a;
  }

  async updateRescheduleRequest(id: any, rescheduleRequest: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.rescheduleRequest = rescheduleRequest;
    return a;
  }

  async applyReschedule(id: any, appointmentDate: Date, timeSlot: string, rescheduleRequest: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.appointmentDate = appointmentDate;
    a.timeSlot = timeSlot;
    a.status = "confirmed";
    a.rescheduleRequest = rescheduleRequest;
    return a;
  }

  async find(filter: any = {}) {
    return [];
  }
}

class TestDoctorRepository implements Partial<IDoctorRepository> {
  public doctors: any[] = [];

  async findById(id: any) {
    return this.doctors.find((d) => String(d._id) === String(id)) || null;
  }

  async findByUserId(userId: any) {
    return this.doctors.find((d) => String(d.user?._id || d.user) === String(userId)) || null;
  }
}

class TestUserRepository implements Partial<IUserRepository> {
  public users: any[] = [];

  async findById(id: any) {
    return this.users.find((u) => String(u._id) === String(id)) || null;
  }
}

class TestPaymentRepository implements Partial<IPaymentRepository> {
  public payments: any[] = [];

  async create(data: any) {
    const payment = {
      _id: `pay_${Date.now()}`,
      createdAt: new Date(),
      ...data,
    };
    this.payments.push(payment);
    return payment;
  }

  async findById(id: any) {
    return this.payments.find((p) => String(p._id) === String(id)) || null;
  }

  async updateStatus(id: any, status: string, extra: any = {}) {
    const p = await this.findById(id);
    if (!p) return null;
    p.status = status;
    Object.assign(p, extra);
    return p;
  }
}

describe("Appointment Notification & Nodemailer Email Service Tests", () => {
  let notifRepo: TestNotificationRepository;
  let mockEmailService: MockEmailService;
  let userRepo: TestUserRepository;
  let docRepo: TestDoctorRepository;
  let apptRepo: TestAppointmentRepository;
  let paymentRepo: TestPaymentRepository;
  let notifService: NotificationService;
  let doctorService: DoctorService;
  let appointmentService: AppointmentService;
  let paymentService: PaymentService;

  const patientUserId = "patient_user_001";
  const doctorUserId = "doctor_user_001";
  const doctorId = "doctor_doc_001";

  beforeEach(() => {
    notifRepo = new TestNotificationRepository();
    mockEmailService = new MockEmailService();
    userRepo = new TestUserRepository();
    docRepo = new TestDoctorRepository();
    apptRepo = new TestAppointmentRepository();
    paymentRepo = new TestPaymentRepository();

    // Setup Mock User data
    userRepo.users.push(
      {
        _id: patientUserId,
        name: "Alice Smith",
        email: "alice@example.com",
        role: "patient",
      },
      {
        _id: doctorUserId,
        name: "Dr. Gregory House",
        email: "house@princetonplainsboro.com",
        role: "doctor",
      },
    );

    // Setup Mock Doctor data
    docRepo.doctors.push({
      _id: doctorId,
      user: {
        _id: doctorUserId,
        name: "Dr. Gregory House",
        email: "house@princetonplainsboro.com",
      },
      specialization: "Diagnostic Medicine",
      consultationFee: 750,
      available: true,
      verificationStatus: "verified",
    });

    notifService = new NotificationService(
      notifRepo as any,
      mockEmailService,
      userRepo as any,
      docRepo as any,
    );

    doctorService = new DoctorService(
      docRepo as any,
      apptRepo as any,
      notifRepo as any,
      {} as any,
      {} as any,
      userRepo as any,
      {} as any,
      notifService,
    );

    appointmentService = new AppointmentService(
      apptRepo as any,
      docRepo as any,
      {} as any,
      notifRepo as any,
      userRepo as any,
      notifService,
    );

    const mockGateway = new MockPaymentGateway();
    paymentService = new PaymentService(
      paymentRepo as any,
      apptRepo as any,
      docRepo as any,
      notifRepo as any,
      userRepo as any,
      mockGateway,
      notifService,
    );
  });

  it("1. Appointment confirmed → confirmation email sent with all details", async () => {
    const appt = await apptRepo.create({
      patient: {
        _id: patientUserId,
        name: "Alice Smith",
        email: "alice@example.com",
      },
      doctor: {
        _id: doctorId,
        specialization: "Diagnostic Medicine",
        user: { _id: doctorUserId, name: "Dr. Gregory House" },
      },
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "10:30 AM",
      status: "confirmed",
      reason: "Persistent migraine",
    });

    const result = await notifService.sendAppointmentConfirmation(appt);

    assert.equal(result.emailResult?.success, true);
    assert.equal(mockEmailService.sentEmails.length, 1);

    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Appointment Confirmed/);
    assert.match(sent.html, /Alice Smith/);
    assert.match(sent.html, /Dr\. Gregory House/);
    assert.match(sent.html, /10:30 AM/);
    assert.match(sent.html, new RegExp(appt._id));

    // Verify In-App notifications were also created for patient and doctor
    assert.equal(notifRepo.notifications.length, 2);
    assert.equal(notifRepo.notifications[0].recipient, patientUserId);
    assert.equal(notifRepo.notifications[1].recipient, doctorUserId);
  });

  it("2. Appointment cancelled → cancellation email sent with cancellation reason and details", async () => {
    const appt = await apptRepo.create({
      patient: {
        _id: patientUserId,
        name: "Alice Smith",
        email: "alice@example.com",
      },
      doctor: {
        _id: doctorId,
        specialization: "Diagnostic Medicine",
        user: { _id: doctorUserId, name: "Dr. Gregory House" },
      },
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "10:30 AM",
      status: "scheduled",
      reason: "Routine Checkup",
    });

    const result = await notifService.sendAppointmentCancellation(
      appt,
      "scheduled",
      "Emergency surgery duty",
      "doctor",
    );

    assert.equal(result.emailResult?.success, true);
    assert.equal(mockEmailService.sentEmails.length, 1);

    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Appointment Cancelled/);
    assert.match(sent.html, /Emergency surgery duty/);
    assert.match(sent.html, /Alice Smith/);
    assert.match(sent.html, /Dr\. Gregory House/);
  });

  it("3. Appointment status changed → status update email sent with previous and new status", async () => {
    const appt = await apptRepo.create({
      patient: {
        _id: patientUserId,
        name: "Alice Smith",
        email: "alice@example.com",
      },
      doctor: {
        _id: doctorId,
        specialization: "Diagnostic Medicine",
        user: { _id: doctorUserId, name: "Dr. Gregory House" },
      },
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "11:00 AM",
      status: "scheduled",
    });

    const result = await notifService.sendAppointmentStatusUpdate(
      appt,
      "scheduled",
      "completed",
      "Consultation completed successfully",
    );

    assert.equal(result.emailResult?.success, true);
    assert.equal(mockEmailService.sentEmails.length, 1);

    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Status Updated: COMPLETED/);
    assert.match(sent.html, /scheduled/);
    assert.match(sent.html, /completed/);
  });

  it("4. Same status update twice → no duplicate notification or email sent", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "11:00 AM",
      status: "completed",
    });

    // Attempting to update to same status "completed" via DoctorService
    const updated = await doctorService.updateAppointmentStatusForDoctor(
      doctorUserId,
      appt._id,
      "completed",
    );

    assert.equal(updated.status, "completed");
    assert.equal(mockEmailService.sentEmails.length, 0);
    assert.equal(notifRepo.notifications.length, 0);

    // Also verify directly on NotificationService
    const notifResult = await notifService.sendAppointmentStatusUpdate(
      appt,
      "completed",
      "completed",
    );
    assert.equal(notifResult.skippedDuplicate, true);
    assert.equal(mockEmailService.sentEmails.length, 0);
  });

  it("5. Invalid or missing email → handled gracefully without throwing", async () => {
    const apptNoEmail = await apptRepo.create({
      patient: {
        _id: "patient_invalid_001",
        name: "Ghost Patient",
        email: "not-a-valid-email",
      },
      doctor: {
        _id: doctorId,
        user: { _id: doctorUserId, name: "Dr. Gregory House" },
      },
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "02:00 PM",
      status: "confirmed",
    });

    // Should complete cleanly without throwing an exception
    const result = await notifService.sendAppointmentConfirmation(apptNoEmail);
    assert.equal(result.emailResult?.success, false);
    assert.match(result.emailResult?.error || "", /Invalid/);
    assert.equal(mockEmailService.sentEmails.length, 0);
  });

  it("6. SMTP/email failure → handled gracefully without breaking appointment operation", async () => {
    // Configure mock email service to simulate SMTP outage
    mockEmailService.shouldFail = true;
    mockEmailService.failureErrorMessage = "535 Authentication failed: Bad credentials";

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "03:00 PM",
      status: "scheduled",
    });

    // Doctor marks appointment as cancelled
    const result = await doctorService.updateAppointmentStatusForDoctor(
      doctorUserId,
      appt._id,
      "cancelled",
      "Doctor sick leave",
    );

    // Appointment status must STILL be updated to cancelled
    assert.equal(result.status, "cancelled");
    assert.equal(mockEmailService.sentEmails.length, 0);
  });

  it("7. Patient cancels appointment → cancellation email sent and status updated to cancelled", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "04:00 PM",
      status: "confirmed",
    });

    const result = await appointmentService.cancelAppointment({
      patientUserId,
      appointmentId: appt._id,
      reason: "Change of travel plans",
    });

    assert.equal(result.status, "cancelled");
    assert.equal(mockEmailService.sentEmails.length, 1);
    assert.match(mockEmailService.sentEmails[0].subject, /Appointment Cancelled/);
    assert.match(mockEmailService.sentEmails[0].html, /Change of travel plans/);
  });

  it("8. Payment verified → appointment confirmed and confirmation email sent", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "05:00 PM",
      status: "pending_payment",
    });

    const payment = await paymentRepo.create({
      patientId: patientUserId,
      bookingId: appt._id,
      amount: 750,
      currency: "INR",
      status: "PENDING",
      provider: "MOCK",
      providerOrderId: "order_mock_001",
    });

    const verifyResult = await paymentService.verifyPayment({
      paymentId: payment._id,
      patientUserId,
      simulateStatus: "SUCCESS",
    });

    assert.equal(verifyResult.success, true);
    assert.equal(verifyResult.appointment?.status, "confirmed");

    // Confirmation email sent
    assert.equal(mockEmailService.sentEmails.length, 1);
    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Appointment Confirmed/);
    assert.match(sent.html, /Alice Smith/);
  });

  it("9. Reschedule requested by doctor → reschedule request email sent with proposed new schedule", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "10:00 AM",
      status: "confirmed",
    });

    const result = await appointmentService.requestAppointmentReschedule({
      doctorUserId,
      appointmentId: appt._id,
      newDate: "2026-10-18",
      newTimeSlot: "02:00 PM",
      reason: "Conference attendance",
    });

    assert.equal(result?.rescheduleRequest?.status, "pending");
    assert.equal(mockEmailService.sentEmails.length, 1);

    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Reschedule Request/);
    assert.match(sent.html, /Conference attendance/);
    assert.match(sent.html, /02:00 PM/);
  });

  it("10. Reschedule accepted by patient → reschedule confirmation email sent with updated schedule", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date("2026-10-15"),
      timeSlot: "10:00 AM",
      status: "confirmed",
      rescheduleRequest: {
        status: "pending",
        proposedDate: new Date("2026-10-18"),
        proposedTimeSlot: "02:00 PM",
        reason: "Doctor schedule adjustment",
        requestedBy: "doctor",
      },
    });

    const response = await appointmentService.respondAppointmentReschedule({
      patientUserId,
      appointmentId: appt._id,
      action: "accept",
    });

    assert.equal(response.appointment?.status, "confirmed");
    assert.equal(response.appointment?.timeSlot, "02:00 PM");
    assert.equal(mockEmailService.sentEmails.length, 1);

    const sent = mockEmailService.sentEmails[0];
    assert.equal(sent.to, "alice@example.com");
    assert.match(sent.subject, /Rescheduled Appointment Confirmed/);
    assert.match(sent.html, /02:00 PM/);
  });
});
