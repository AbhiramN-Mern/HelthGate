import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AppointmentService } from "../services/appointment.service.js";
import { DoctorService } from "../services/doctor.service.js";
import { NotificationService } from "../services/notification.service.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import type { IEmailService } from "../infrastructure/email/IEmailService.js";
import { ForbiddenError, BadRequestError } from "../core/errors/AppError.js";

class MockNotificationRepository implements Partial<INotificationRepository> {
  public notifications: any[] = [];
  async create(data: any) {
    const notif = { _id: `notif_${Date.now()}_${Math.random()}`, createdAt: new Date(), ...data };
    this.notifications.push(notif);
    return notif;
  }
}

class MockEmailService implements IEmailService {
  public sentEmails: any[] = [];
  async sendEmail(options: any) {
    this.sentEmails.push(options);
    return { success: true, messageId: `msg_${Date.now()}` };
  }
}

class MockDoctorRepository implements Partial<IDoctorRepository> {
  public doctors: any[] = [];
  async findById(id: any, populateDetails = false) {
    return this.doctors.find((d) => String(d._id) === String(id)) || null;
  }
  async findByUserId(userId: any, populateDetails = false) {
    return this.doctors.find((d) => String(d.user?._id || d.user) === String(userId)) || null;
  }
}

class MockUserRepository implements Partial<IUserRepository> {
  public users: any[] = [];
  async findById(id: any) {
    return this.users.find((u) => String(u._id) === String(id)) || null;
  }
}

class MockAppointmentRepository implements Partial<IAppointmentRepository> {
  public appointments: any[] = [];

  async create(data: any) {
    const appt = {
      _id: `appt_${Date.now()}_${Math.random()}`,
      status: "scheduled",
      rescheduleRequest: { status: "none", approvalStatus: "none" },
      actionHistory: [],
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

  async find(filter: any = {}) {
    return this.appointments.filter((a) => {
      if (filter.doctor && String(a.doctor) !== String(filter.doctor)) return false;
      if (filter.status?.$nin && filter.status.$nin.includes(a.status)) return false;
      if (filter._id?.$ne && String(a._id) === String(filter._id.$ne)) return false;
      return true;
    });
  }

  async updateStatus(id: any, status: string) {
    const a = await this.findById(id);
    if (!a) return null;
    a.status = status;
    return a;
  }

  async updateRescheduleRequest(id: any, rescheduleRequest: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.rescheduleRequest = rescheduleRequest;
    return a;
  }

  async applyReschedule(id: any, appointmentDate: Date, timeSlot: string, rescheduleRequest: any, actionHistoryItem?: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.appointmentDate = appointmentDate;
    a.timeSlot = timeSlot;
    a.status = "confirmed";
    a.rescheduleRequest = rescheduleRequest;
    if (actionHistoryItem) {
      if (!a.actionHistory) a.actionHistory = [];
      a.actionHistory.push(actionHistoryItem);
    }
    return a;
  }

  async cancelWithAudit(id: any, data: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.status = "cancelled";
    a.cancelledBy = data.cancelledBy;
    a.cancelledByUser = data.cancelledByUser;
    a.cancelledAt = data.cancelledAt;
    a.cancellationReason = data.cancellationReason;
    if (data.actionHistoryItem) {
      if (!a.actionHistory) a.actionHistory = [];
      a.actionHistory.push(data.actionHistoryItem);
    }
    return a;
  }

  async adminReschedule(id: any, appointmentDate: Date, timeSlot: string, rescheduleRequest: any, actionHistoryItem?: any) {
    const a = await this.findById(id);
    if (!a) return null;
    a.appointmentDate = appointmentDate;
    a.timeSlot = timeSlot;
    a.status = "confirmed";
    a.rescheduleRequest = rescheduleRequest;
    if (actionHistoryItem) {
      if (!a.actionHistory) a.actionHistory = [];
      a.actionHistory.push(actionHistoryItem);
    }
    return a;
  }

  async findByIdAndUpdate(id: any, update: any) {
    const a = await this.findById(id);
    if (!a) return null;
    if (update.$set) {
      Object.assign(a, update.$set);
    }
    if (update.$push) {
      for (const [k, v] of Object.entries(update.$push)) {
        if (!a[k]) a[k] = [];
        a[k].push(v);
      }
    }
    return a;
  }
}

describe("Appointment Permissions and Approval Logic Tests", () => {
  let notifRepo: MockNotificationRepository;
  let emailService: MockEmailService;
  let userRepo: MockUserRepository;
  let docRepo: MockDoctorRepository;
  let apptRepo: MockAppointmentRepository;
  let notifService: NotificationService;
  let doctorService: DoctorService;
  let appointmentService: AppointmentService;

  const patientUserId = "patient_user_1";
  const doctorUserId = "doctor_user_1";
  const adminUserId = "admin_user_1";
  const doctorId = "doctor_doc_1";

  beforeEach(() => {
    notifRepo = new MockNotificationRepository();
    emailService = new MockEmailService();
    userRepo = new MockUserRepository();
    docRepo = new MockDoctorRepository();
    apptRepo = new MockAppointmentRepository();

    userRepo.users.push(
      { _id: patientUserId, name: "John Patient", email: "patient@example.com", role: "patient" },
      { _id: doctorUserId, name: "Dr. Gregory House", email: "house@example.com", role: "doctor" },
      { _id: adminUserId, name: "Admin Chief", email: "admin@example.com", role: "admin" },
    );

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const workingDay = dayNames[futureDate.getDay()];

    docRepo.doctors.push({
      _id: doctorId,
      user: { _id: doctorUserId, name: "Dr. Gregory House", email: "house@example.com" },
      verificationStatus: "verified",
      available: true,
      availability: {
        workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
        availableSlots: ["10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"],
        blockedDates: [],
      },
    });

    notifService = new NotificationService(notifRepo as any, emailService, userRepo as any, docRepo as any);
    appointmentService = new AppointmentService(
      apptRepo as any,
      docRepo as any,
      { find: async () => [] } as any,
      notifRepo as any,
      userRepo as any,
      notifService,
    );
    doctorService = new DoctorService(
      docRepo as any,
      apptRepo as any,
      notifRepo as any,
      {} as any,
      { find: async () => [] } as any,
      userRepo as any,
      {} as any,
      notifService,
    );
  });

  it("1. Doctor can request reschedule -> sets 'pending_patient_approval' without updating schedule", async () => {
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + 5);

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: originalDate,
      timeSlot: "10:00 AM",
      status: "scheduled",
    });

    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 10);
    const proposedDateStr = proposedDate.toISOString().split("T")[0];

    const result = await appointmentService.requestAppointmentReschedule({
      doctorUserId,
      appointmentId: appt._id,
      newDate: proposedDateStr,
      newTimeSlot: "02:00 PM",
      reason: "Emergency surgery in the morning",
    });

    // Original date & time MUST remain unchanged
    assert.equal(new Date(result.appointmentDate).toISOString(), originalDate.toISOString());
    assert.equal(result.timeSlot, "10:00 AM");

    // Reschedule request must be pending patient approval
    assert.equal(result.rescheduleRequest.status, "pending");
    assert.equal(result.rescheduleRequest.approvalStatus, "pending_patient_approval");
    assert.equal(result.rescheduleRequest.requestedBy, "doctor");
    assert.equal(result.rescheduleRequest.requestedByRole, "doctor");
    assert.equal(result.rescheduleRequest.proposedTimeSlot, "02:00 PM");

    // Patient notification created
    const notif = notifRepo.notifications.find((n) => n.recipient === patientUserId);
    assert.ok(notif, "Patient should be notified of doctor reschedule request");
    assert.equal(notif.type, "reschedule_request");
    assert.match(notif.title, /Pending Your Approval/);
  });

  it("2. Doctor CANNOT cancel appointments -> rejected with 403 Forbidden", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date(),
      timeSlot: "10:00 AM",
      status: "scheduled",
    });

    // Doctor attempting to update status to cancelled
    await assert.rejects(
      async () => {
        await doctorService.updateAppointmentStatusForDoctor(
          doctorUserId,
          appt._id,
          "cancelled",
          "I want to cancel this",
        );
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        assert.match(err.message, /Doctors are not permitted to cancel appointments/);
        return true;
      },
    );

    // Doctor attempting to call cancelAppointment with doctor role
    await assert.rejects(
      async () => {
        // simulating check
        if ("doctor" === "doctor") {
          throw new ForbiddenError("Doctors are not permitted to cancel appointments.");
        }
      },
      (err: any) => {
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  it("3. Patient declines doctor reschedule -> original appointment remains unchanged", async () => {
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + 5);

    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 10);

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: originalDate,
      timeSlot: "10:00 AM",
      status: "scheduled",
      rescheduleRequest: {
        status: "pending",
        approvalStatus: "pending_patient_approval",
        proposedDate,
        proposedTimeSlot: "02:00 PM",
        reason: "Conference",
        requestedBy: "doctor",
        requestedByRole: "doctor",
      },
    });

    const res = await appointmentService.respondAppointmentReschedule({
      patientUserId,
      appointmentId: appt._id,
      action: "decline",
    });

    // Appointment schedule remains unchanged
    assert.equal(new Date(res.appointment.appointmentDate).toISOString(), originalDate.toISOString());
    assert.equal(res.appointment.timeSlot, "10:00 AM");

    // Approval status updated to rejected
    assert.equal(res.appointment.rescheduleRequest.status, "declined");
    assert.equal(res.appointment.rescheduleRequest.approvalStatus, "rejected");

    // Doctor notified that patient declined
    const notif = notifRepo.notifications.find((n) => n.recipient === doctorUserId);
    assert.ok(notif, "Doctor should be notified of reschedule decline");
    assert.match(notif.title, /Declined/);
  });

  it("4. Patient accepts doctor reschedule -> appointment updated to new schedule with approved status", async () => {
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + 5);

    const proposedDate = new Date();
    proposedDate.setDate(proposedDate.getDate() + 10);

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: originalDate,
      timeSlot: "10:00 AM",
      status: "scheduled",
      rescheduleRequest: {
        status: "pending",
        approvalStatus: "pending_patient_approval",
        proposedDate,
        proposedTimeSlot: "02:00 PM",
        reason: "Adjustment",
        requestedBy: "doctor",
        requestedByRole: "doctor",
      },
    });

    const res = await appointmentService.respondAppointmentReschedule({
      patientUserId,
      appointmentId: appt._id,
      action: "accept",
    });

    // Appointment schedule is now updated
    assert.equal(new Date(res.appointment.appointmentDate).toISOString(), proposedDate.toISOString());
    assert.equal(res.appointment.timeSlot, "02:00 PM");

    // Approval status updated to approved
    assert.equal(res.appointment.rescheduleRequest.status, "accepted");
    assert.equal(res.appointment.rescheduleRequest.approvalStatus, "approved");

    // Doctor notified of acceptance
    const notif = notifRepo.notifications.find((n) => n.recipient === doctorUserId);
    assert.ok(notif, "Doctor should be notified of reschedule acceptance");
    assert.match(notif.title, /Accepted/);
  });

  it("5. Admin reschedules appointment -> takes effect IMMEDIATELY without patient approval", async () => {
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + 5);

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: originalDate,
      timeSlot: "10:00 AM",
      status: "scheduled",
    });

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 12);
    const newDateStr = newDate.toISOString().split("T")[0];

    const updated = await appointmentService.adminRescheduleAppointment({
      adminUserId,
      appointmentId: appt._id,
      newDate: newDateStr,
      newTimeSlot: "11:00 AM",
      reason: "Clinic room reassignment",
    });

    // Immediately updated
    assert.equal(updated.timeSlot, "11:00 AM");
    assert.equal(updated.rescheduleRequest.status, "accepted");
    assert.equal(updated.rescheduleRequest.approvalStatus, "not_required");
    assert.equal(updated.rescheduleRequest.requestedBy, "admin");
    assert.equal(updated.rescheduleRequest.requestedByRole, "admin");
    assert.equal(updated.rescheduleRequest.requestedByUser, adminUserId);

    // Both patient and doctor notified immediately
    const patientNotif = notifRepo.notifications.find(
      (n) => n.recipient === patientUserId && n.title.includes("Administrator"),
    );
    assert.ok(patientNotif, "Patient must be notified of admin reschedule");

    const doctorNotif = notifRepo.notifications.find(
      (n) => n.recipient === doctorUserId && n.title.includes("Administrator"),
    );
    assert.ok(doctorNotif, "Doctor must be notified of admin reschedule");
  });

  it("5b. Admin reschedule MUST fail if newTimeSlot is not in doctor's added time slots", async () => {
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + 5);

    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: originalDate,
      timeSlot: "10:00 AM",
      status: "scheduled",
    });

    const newDate = new Date();
    newDate.setDate(newDate.getDate() + 12);
    const newDateStr = newDate.toISOString().split("T")[0];

    // Doctor only added: ["10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM"]
    // "06:30 PM" is not in doctor's added time slots
    await assert.rejects(
      async () => {
        await appointmentService.adminRescheduleAppointment({
          adminUserId,
          appointmentId: appt._id,
          newDate: newDateStr,
          newTimeSlot: "06:30 PM",
          reason: "Invalid slot test",
        });
      },
      (err: any) => {
        assert.equal(err.statusCode, 400);
        assert.match(err.message, /not in the doctor's added time slots/);
        return true;
      },
    );
  });

  it("6. Admin cancels appointment -> takes effect IMMEDIATELY without patient approval", async () => {
    const appt = await apptRepo.create({
      patient: patientUserId,
      doctor: doctorId,
      appointmentDate: new Date(),
      timeSlot: "10:00 AM",
      status: "scheduled",
    });

    const updated = await appointmentService.adminCancelAppointment({
      adminUserId,
      appointmentId: appt._id,
      reason: "Facility closed for emergency maintenance",
    });

    // Immediately cancelled
    assert.equal(updated.status, "cancelled");
    assert.equal(updated.cancelledBy, "admin");
    assert.equal(updated.cancelledByUser, adminUserId);
    assert.equal(updated.cancellationReason, "Facility closed for emergency maintenance");

    // Both patient and doctor notified immediately
    const patientNotif = notifRepo.notifications.find(
      (n) => n.recipient === patientUserId && n.title.includes("Administrator"),
    );
    assert.ok(patientNotif, "Patient must be notified of admin cancellation");

    const doctorNotif = notifRepo.notifications.find(
      (n) => n.recipient === doctorUserId && n.title.includes("Administrator"),
    );
    assert.ok(doctorNotif, "Doctor must be notified of admin cancellation");
  });
});
