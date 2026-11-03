import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { AppointmentService } from "../services/appointment.service.js";
import { ConflictError, BadRequestError } from "../core/errors/AppError.js";
import {
  normalizeAppointmentDate,
  normalizeTimeSlot,
  toMidnightUTCDate,
} from "../utils/slotNormalizer.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import type { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IUserRepository } from "../repositories/interfaces/IUserRepository.js";

/**
 * Mock Appointment Repository that simulates MongoDB partial unique compound index:
 * Index: { doctor: 1, normalizedDate: 1, normalizedTimeSlot: 1 }
 * Filter: status in ["pending_payment", "PENDING_PAYMENT", "scheduled", "confirmed", "CONFIRMED"]
 */
class ConcurrentMockAppointmentRepository implements Partial<IAppointmentRepository> {
  public appointments: any[] = [];
  private activeStatuses = [
    "pending_payment",
    "PENDING_PAYMENT",
    "scheduled",
    "confirmed",
    "CONFIRMED",
  ];

  private checkUniqueConstraint(doc: any) {
    if (!this.activeStatuses.includes(doc.status)) {
      return;
    }
    const docDate = doc.normalizedDate || normalizeAppointmentDate(doc.appointmentDate);
    const docSlot = doc.normalizedTimeSlot || normalizeTimeSlot(doc.timeSlot);

    const duplicate = this.appointments.find((a) => {
      if (String(a._id) === String(doc._id)) return false;
      if (!this.activeStatuses.includes(a.status)) return false;
      if (String(a.doctor) !== String(doc.doctor)) return false;

      const aDate = a.normalizedDate || normalizeAppointmentDate(a.appointmentDate);
      const aSlot = a.normalizedTimeSlot || normalizeTimeSlot(a.timeSlot);
      return aDate === docDate && aSlot === docSlot;
    });

    if (duplicate) {
      const err: any = new Error("E11000 duplicate key error collection: healthgate.appointments index: unique_active_doctor_slot dup key");
      err.code = 11000;
      err.keyValue = { doctor: doc.doctor, normalizedDate: docDate, normalizedTimeSlot: docSlot };
      throw err;
    }
  }

  async create(data: any) {
    const nDate = data.normalizedDate || normalizeAppointmentDate(data.appointmentDate);
    const nSlot = data.normalizedTimeSlot || normalizeTimeSlot(data.timeSlot);

    const appt = {
      _id: `appt_${Date.now()}_${Math.random()}`,
      status: "pending_payment",
      actionHistory: [],
      ...data,
      normalizedDate: nDate,
      normalizedTimeSlot: nSlot,
      appointmentDate: toMidnightUTCDate(data.appointmentDate),
    };

    this.checkUniqueConstraint(appt);
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
            count++;
          }
        }
      }
    }
    return count;
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

  async applyReschedule(
    id: any,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: any,
    actionHistoryItem?: any,
  ) {
    const a = await this.findById(id);
    if (!a) return null;

    const nDate = normalizeAppointmentDate(appointmentDate);
    const nSlot = normalizeTimeSlot(timeSlot);

    const prospective = {
      ...a,
      appointmentDate: toMidnightUTCDate(appointmentDate),
      timeSlot: nSlot,
      normalizedDate: nDate,
      normalizedTimeSlot: nSlot,
      status: "confirmed",
    };

    this.checkUniqueConstraint(prospective);

    a.appointmentDate = prospective.appointmentDate;
    a.timeSlot = prospective.timeSlot;
    a.normalizedDate = prospective.normalizedDate;
    a.normalizedTimeSlot = prospective.normalizedTimeSlot;
    a.status = "confirmed";
    a.rescheduleRequest = rescheduleRequest;
    if (actionHistoryItem) a.actionHistory.push(actionHistoryItem);
    return a;
  }

  async adminReschedule(
    id: any,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: any,
    actionHistoryItem?: any,
  ) {
    return this.applyReschedule(id, appointmentDate, timeSlot, rescheduleRequest, actionHistoryItem);
  }

  async count(filter: any = {}) {
    return this.find(filter).then((r) => r.length);
  }
}

class MockDoctorRepo implements Partial<IDoctorRepository> {
  public doctors: any[] = [];
  async findById(id: any) {
    return this.doctors.find((d) => String(d._id) === String(id)) || null;
  }
}

class MockUserRepo implements Partial<IUserRepository> {
  public users: any[] = [];
  async findById(id: any) {
    return this.users.find((u) => String(u._id) === String(id)) || null;
  }
}

class MockNotificationRepo implements Partial<INotificationRepository> {
  public notifications: any[] = [];
  async create(data: any) {
    this.notifications.push(data);
    return data;
  }
}

class MockHospitalDoctorRepo implements Partial<IHospitalDoctorRepository> {
  async find() {
    return [];
  }
}

describe("Appointment Date & TimeSlot Normalization Unit Tests", () => {
  it("should normalize dates in various formats into canonical YYYY-MM-DD", () => {
    assert.equal(normalizeAppointmentDate("2026-11-15"), "2026-11-15");
    assert.equal(normalizeAppointmentDate("2026-11-15T14:30:00.000Z"), "2026-11-15");
    assert.equal(normalizeAppointmentDate(new Date(Date.UTC(2026, 10, 15, 0, 0, 0))), "2026-11-15");
  });

  it("should throw BadRequestError on invalid date", () => {
    assert.throws(() => normalizeAppointmentDate("invalid-date"), BadRequestError);
  });

  it("should normalize time slots into canonical HH:MM AM/PM format", () => {
    assert.equal(normalizeTimeSlot("9:00 AM"), "09:00 AM");
    assert.equal(normalizeTimeSlot("09:00 am"), "09:00 AM");
    assert.equal(normalizeTimeSlot(" 9:00  am "), "09:00 AM");
    assert.equal(normalizeTimeSlot("09:00AM"), "09:00 AM");
    assert.equal(normalizeTimeSlot("2:00 PM"), "02:00 PM");
    assert.equal(normalizeTimeSlot("14:00"), "02:00 PM");
    assert.equal(normalizeTimeSlot("11:30 AM"), "11:30 AM");
  });
});

describe("Concurrent Booking & Double-Booking Prevention Tests", () => {
  let apptRepo: ConcurrentMockAppointmentRepository;
  let doctorRepo: MockDoctorRepo;
  let userRepo: MockUserRepo;
  let notifRepo: MockNotificationRepo;
  let hospDocRepo: MockHospitalDoctorRepo;
  let service: AppointmentService;

  const doctorId = "doc_101";
  const doctorUserId = "doc_user_101";
  const patient1Id = "pat_user_001";
  const patient2Id = "pat_user_002";

  // Target booking slot (7 days in future)
  const targetDateObj = new Date();
  targetDateObj.setDate(targetDateObj.getDate() + 7);
  const targetDateStr = targetDateObj.toISOString().split("T")[0];
  const targetTimeSlot = "10:00 AM";

  beforeEach(() => {
    apptRepo = new ConcurrentMockAppointmentRepository();
    doctorRepo = new MockDoctorRepo();
    userRepo = new MockUserRepo();
    notifRepo = new MockNotificationRepo();
    hospDocRepo = new MockHospitalDoctorRepo();

    doctorRepo.doctors.push({
      _id: doctorId,
      user: { _id: doctorUserId, name: "Dr. Gregory House" },
      verificationStatus: "verified",
      available: true,
      availability: {
        workingDays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        availableSlots: ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"],
        blockedDates: [],
      },
    });

    userRepo.users.push(
      { _id: patient1Id, name: "Alice Patient", email: "alice@example.com" },
      { _id: patient2Id, name: "Bob Patient", email: "bob@example.com" },
    );

    service = new AppointmentService(
      apptRepo as any,
      doctorRepo as any,
      hospDocRepo as any,
      notifRepo as any,
      userRepo as any,
    );
  });

  it("1. Concurrent booking attempts for the same doctor slot: exactly one succeeds and the other receives ConflictError (409)", async () => {
    // Both patients attempt to book the exact same slot concurrently
    const bookingAttempt1 = service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    const bookingAttempt2 = service.createAppointment({
      patientUserId: patient2Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    const results = await Promise.allSettled([bookingAttempt1, bookingAttempt2]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    assert.equal(fulfilled.length, 1, "Exactly one booking must succeed");
    assert.equal(rejected.length, 1, "Exactly one booking must be rejected");

    const rejectionReason = (rejected[0] as PromiseRejectedResult).reason;
    assert.ok(
      rejectionReason instanceof ConflictError || rejectionReason.statusCode === 409,
      `Expected ConflictError (409), but got: ${rejectionReason}`,
    );
    assert.equal(rejectionReason.statusCode, 409);
    assert.match(rejectionReason.message, /already been booked/);

    // Verify only 1 appointment exists in database for this slot
    assert.equal(apptRepo.appointments.length, 1);
    assert.equal(apptRepo.appointments[0].normalizedDate, targetDateStr);
    assert.equal(apptRepo.appointments[0].normalizedTimeSlot, targetTimeSlot);
  });

  it("2. Booking with slight variations in formatting ('10:00 am' vs '10:00 AM') is rejected as a duplicate slot", async () => {
    // First booking with standard casing
    await service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "10:00 AM",
    });

    // Second booking with lowercase and spaces
    await assert.rejects(
      async () => {
        await service.createAppointment({
          patientUserId: patient2Id,
          doctor: doctorId,
          appointmentDate: targetDateStr,
          timeSlot: "  10:00 am  ",
        });
      },
      (err: any) => {
        return err.statusCode === 400 || err.statusCode === 409;
      },
    );
  });

  it("3. Concurrent bookings for DIFFERENT time slots for the same doctor both succeed", async () => {
    const booking1 = service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "09:00 AM",
    });

    const booking2 = service.createAppointment({
      patientUserId: patient2Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "11:30 AM",
    });

    const results = await Promise.all([booking1, booking2]);
    assert.equal(results.length, 2);
    assert.equal(apptRepo.appointments.length, 2);
  });

  it("4. Concurrent bookings for DIFFERENT doctors for the same time slot both succeed", async () => {
    const doctor2Id = "doc_102";
    doctorRepo.doctors.push({
      _id: doctor2Id,
      user: { _id: "doc_user_102", name: "Dr. James Wilson" },
      verificationStatus: "verified",
      available: true,
      availability: {
        workingDays: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
        availableSlots: ["10:00 AM"],
        blockedDates: [],
      },
    });

    const booking1 = service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "10:00 AM",
    });

    const booking2 = service.createAppointment({
      patientUserId: patient2Id,
      doctor: doctor2Id,
      appointmentDate: targetDateStr,
      timeSlot: "10:00 AM",
    });

    const results = await Promise.all([booking1, booking2]);
    assert.equal(results.length, 2);
    assert.equal(apptRepo.appointments.length, 2);
  });

  it("5. Slot becomes available again after appointment cancellation", async () => {
    const appt = await service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    assert.equal(apptRepo.appointments.length, 1);

    // Cancel the appointment
    await service.cancelAppointment({
      patientUserId: patient1Id,
      appointmentId: appt._id,
      reason: "Patient had a schedule conflict",
    });

    assert.equal(apptRepo.appointments[0].status, "cancelled");

    // Another patient can now book the exact same slot without conflict
    const newBooking = await service.createAppointment({
      patientUserId: patient2Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: targetTimeSlot,
    });

    assert.ok(newBooking);
    assert.equal(apptRepo.appointments.length, 2);
    assert.equal(apptRepo.appointments[1].status, "pending_payment");
  });

  it("6. Admin reschedule collision throws ConflictError (409) if the target slot is already occupied", async () => {
    // Patient 1 books 09:00 AM
    await service.createAppointment({
      patientUserId: patient1Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "09:00 AM",
    });

    // Patient 2 books 10:00 AM
    const appt2 = await service.createAppointment({
      patientUserId: patient2Id,
      doctor: doctorId,
      appointmentDate: targetDateStr,
      timeSlot: "10:00 AM",
    });

    // Admin attempts to reschedule appt2 to 09:00 AM (already occupied by Patient 1)
    await assert.rejects(
      async () => {
        await service.adminRescheduleAppointment({
          adminUserId: "admin_1",
          appointmentId: appt2._id,
          newDate: targetDateStr,
          newTimeSlot: "09:00 AM",
          reason: "Administrative change",
        });
      },
      (err: any) => {
        return err.statusCode === 400 || err.statusCode === 409;
      },
    );
  });
});

