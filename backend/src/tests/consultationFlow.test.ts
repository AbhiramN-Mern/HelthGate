import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { VideoCallService } from "../services/videoCall.service.js";
import { PrescriptionService } from "../services/prescription.service.js";
import { AppointmentService } from "../services/appointment.service.js";

// In-memory repositories for pure, isolated unit testing
class MockAppointmentRepo {
  public appointments: any[] = [];

  async create(data: any) {
    const doc = {
      _id: new Types.ObjectId(),
      status: "pending_payment",
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.appointments.push(doc);
    return doc;
  }

  async findById(id: any) {
    const found = this.appointments.find(
      (a) => a._id.toString() === id.toString(),
    );
    return found || null;
  }

  async find(filter: any = {}) {
    return this.appointments.filter((a) => {
      for (const key of Object.keys(filter)) {
        if (key === "doctor" && a.doctor?.toString() !== filter[key].toString()) return false;
        if (key === "patient" && a.patient?.toString() !== filter[key].toString()) return false;
        if (key === "status" && filter[key]?.$nin && filter[key].$nin.includes(a.status)) return false;
      }
      return true;
    });
  }

  async findByIdAndUpdate(id: any, update: any) {
    const appt = await this.findById(id);
    if (!appt) return null;

    for (const [key, value] of Object.entries(update)) {
      if (key.includes(".")) {
        const [parent, child] = key.split(".");
        appt[parent] = appt[parent] || {};
        appt[parent][child] = value;
      } else {
        appt[key] = value;
      }
    }
    return appt;
  }

  async count() {
    return this.appointments.length;
  }
}

class MockCallSessionRepo {
  public sessions: any[] = [];

  async create(data: any) {
    const session = {
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      status: "ringing",
      startedAt: null,
      endedAt: null,
      duration: 0,
      ...data,
    };
    this.sessions.push(session);
    return session;
  }

  async findById(id: any) {
    return (
      this.sessions.find((s) => s._id.toString() === id.toString()) || null
    );
  }

  async findActiveByAppointment(appointmentId: any) {
    return (
      this.sessions.find(
        (s) =>
          s.appointmentId.toString() === appointmentId.toString() &&
          (s.status === "ringing" || s.status === "active"),
      ) || null
    );
  }

  async updateStatus(id: any, status: string, extra: any = {}) {
    const session = await this.findById(id);
    if (!session) return null;
    session.status = status;
    Object.assign(session, extra);
    return session;
  }
}

class MockPrescriptionRepo {
  public prescriptions: any[] = [];

  async create(data: any) {
    const record = {
      _id: new Types.ObjectId(),
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
    };
    this.prescriptions.push(record);
    return record;
  }

  async findById(id: any) {
    return (
      this.prescriptions.find((p) => p._id.toString() === id.toString()) || null
    );
  }

  async findByAppointmentId(appointmentId: any) {
    return (
      this.prescriptions.find(
        (p) => p.appointment.toString() === appointmentId.toString(),
      ) || null
    );
  }

  async findByPatientId(patientId: any) {
    return this.prescriptions.filter(
      (p) => p.patient.toString() === patientId.toString(),
    );
  }

  async findByDoctorId(doctorId: any) {
    return this.prescriptions.filter(
      (p) => p.doctor.toString() === doctorId.toString(),
    );
  }

  async updateByAppointmentId(appointmentId: any, data: any) {
    const existing = await this.findByAppointmentId(appointmentId);
    if (!existing) return null;
    Object.assign(existing, data, { updatedAt: new Date() });
    return existing;
  }

  async count(filter: any = {}) {
    return this.prescriptions.length;
  }
}

class MockDoctorRepo {
  public doctors: any[] = [];

  async findById(id: any) {
    return this.doctors.find((d) => d._id.toString() === id.toString()) || null;
  }

  async findOne(filter: any) {
    return this.doctors.find((d) => {
      if (filter.user && d.user?._id?.toString() === filter.user.toString()) return true;
      if (filter.user && d.user?.toString() === filter.user.toString()) return true;
      return false;
    }) || null;
  }
}

class MockNotificationService {
  public sentNotifications: any[] = [];

  async sendVideoCallNotification(data: any) {
    this.sentNotifications.push(data);
    return { success: true };
  }
}

describe("HealthGate Consultation Flow & Prescription Tests", () => {
  const patientUserId = new Types.ObjectId().toString();
  const doctorUserId = new Types.ObjectId().toString();
  const doctorDocId = new Types.ObjectId();

  const mockDoctor = {
    _id: doctorDocId,
    user: { _id: new Types.ObjectId(doctorUserId), name: "Dr. Gregory House" },
    specialization: "Internal Medicine",
    verificationStatus: "verified",
    available: true,
    availability: {
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      availableSlots: ["09:00 AM", "10:30 AM", "02:00 PM", "04:30 PM"],
      blockedDates: [],
    },
  };

  it("1. Appointment creation accepts and persists consultationType ('online' and 'offline')", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const hospitalDoctorRepo = { find: async () => [] } as any;
    const notificationRepo = { create: async () => {} } as any;
    const userRepo = { findById: async () => ({ name: "John Doe" }) } as any;

    const appointmentService = new AppointmentService(
      appointmentRepo as any,
      doctorRepo as any,
      hospitalDoctorRepo,
      notificationRepo,
      userRepo,
    );

    // Online appointment
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const dateStr = futureDate.toISOString().split("T")[0];

    const onlineAppt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorDocId.toString(),
      appointmentDate: dateStr,
      timeSlot: "10:30 AM",
      reason: "Flu symptoms",
      consultationType: "online",
    });

    assert.equal(onlineAppt.consultationType, "online");
    assert.equal(onlineAppt.type, "Video");

    // Offline appointment
    const offlineAppt = await appointmentService.createAppointment({
      patientUserId,
      doctor: doctorDocId.toString(),
      appointmentDate: dateStr,
      timeSlot: "02:00 PM",
      reason: "Annual Physical",
      consultationType: "offline",
    });

    assert.equal(offlineAppt.consultationType, "offline");
    assert.equal(offlineAppt.type, "In-Person");
  });

  it("2. Offline appointments strictly reject starting a video consultation", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const callSessionRepo = new MockCallSessionRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const videoCallService = new VideoCallService(
      appointmentRepo as any,
      callSessionRepo as any,
      undefined,
      doctorRepo as any,
    );

    const offlineAppt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: new Date(),
      timeSlot: "10:30 AM",
      status: "confirmed",
      consultationType: "offline",
    });

    await assert.rejects(
      async () => {
        await videoCallService.startConsultationCall({
          appointmentId: offlineAppt._id,
          doctorUserId,
        });
      },
      {
        message: /Video consultation is not available for offline appointments/,
      },
    );
  });

  it("3. Doctor starting online call early preserves scheduled time, records actualStartTime, and marks startedEarly: true", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const callSessionRepo = new MockCallSessionRepo();
    const notifService = new MockNotificationService();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const videoCallService = new VideoCallService(
      appointmentRepo as any,
      callSessionRepo as any,
      notifService as any,
      doctorRepo as any,
    );

    // Appointment scheduled for next year (in the future)
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);

    const onlineAppt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: futureDate,
      timeSlot: "10:30 AM",
      status: "confirmed",
      consultationType: "online",
    });

    const result = await videoCallService.startConsultationCall({
      appointmentId: onlineAppt._id,
      doctorUserId,
    });

    assert.ok(result.roomId);
    assert.equal(result.userRole, "doctor");

    // Verify appointment record in repository
    const updated = await appointmentRepo.findById(onlineAppt._id);
    assert.ok(updated.actualStartTime, "actualStartTime should be recorded");
    assert.equal(updated.startedEarly, true, "startedEarly should be true");
    assert.equal(
      updated.appointmentDate.getTime(),
      futureDate.getTime(),
      "Original scheduled appointmentDate must NOT be modified",
    );
    assert.equal(updated.timeSlot, "10:30 AM", "Original scheduled timeSlot must NOT be modified");
    assert.ok(updated.videoCall.startedAt, "videoCall.startedAt must be recorded");

    // Verify notification was sent with appointment details
    assert.equal(notifService.sentNotifications.length, 1);
    assert.equal(notifService.sentNotifications[0].doctorName, "Dr. Gregory House");

    // Reconnecting should NOT create a duplicate notification
    await videoCallService.startConsultationCall({
      appointmentId: onlineAppt._id,
      doctorUserId,
    });
    assert.equal(
      notifService.sentNotifications.length,
      1,
      "Doctor reconnecting must NOT send duplicate notification",
    );
  });

  it("4. Patient can join early consultation call immediately without waiting", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const callSessionRepo = new MockCallSessionRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const videoCallService = new VideoCallService(
      appointmentRepo as any,
      callSessionRepo as any,
      undefined,
      doctorRepo as any,
    );

    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 2);

    const onlineAppt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: futureDate,
      timeSlot: "10:30 AM",
      status: "confirmed",
      consultationType: "online",
    });

    const callResult = await videoCallService.startConsultationCall({
      appointmentId: onlineAppt._id,
      doctorUserId,
    });

    // Patient joins immediately
    const joinResult = await videoCallService.joinConsultationCall({
      callSessionId: callResult.callSession.id,
      patientUserId,
    });

    assert.equal(joinResult.roomId, callResult.roomId);
    assert.equal(joinResult.userRole, "patient");
    assert.equal(joinResult.doctorName, "Dr. Gregory House");
  });

  it("5. Doctor can create prescription with medicines and updates appointment to completed", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const prescriptionRepo = new MockPrescriptionRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const prescriptionService = new PrescriptionService(
      prescriptionRepo as any,
      appointmentRepo as any,
      doctorRepo as any,
    );

    const appt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: new Date(),
      timeSlot: "10:30 AM",
      status: "confirmed",
      consultationType: "online",
    });

    const prescription = await prescriptionService.createOrUpdatePrescription({
      appointmentId: appt._id,
      doctorUserId,
      diagnosis: "Acute Bronchitis",
      medicines: [
        {
          name: "Amoxicillin",
          dosage: "500 mg",
          frequency: "3 times daily",
          duration: "7 days",
          instructions: "After meals",
        },
        {
          name: "Paracetamol",
          dosage: "650 mg",
          frequency: "As needed for fever",
          duration: "3 days",
          instructions: "After food",
        },
      ],
      additionalAdvice: "Drink plenty of warm fluids and rest.",
      followUpDate: new Date("2026-09-25"),
    });

    assert.ok(prescription);
    assert.equal(prescription.diagnosis, "Acute Bronchitis");
    assert.equal(prescription.medicines.length, 2);
    assert.equal(prescription.medicines[0].name, "Amoxicillin");
    assert.equal(prescription.medicines[1].name, "Paracetamol");

    // Check appointment status automatically marked completed
    const updatedAppt = await appointmentRepo.findById(appt._id);
    assert.equal(updatedAppt.status, "completed");
  });

  it("6. Unauthorized user cannot create prescription for another doctor's appointment", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const prescriptionRepo = new MockPrescriptionRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const prescriptionService = new PrescriptionService(
      prescriptionRepo as any,
      appointmentRepo as any,
      doctorRepo as any,
    );

    const appt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: new Date(),
      timeSlot: "10:30 AM",
      status: "confirmed",
      consultationType: "online",
    });

    const imposterDoctorId = new Types.ObjectId().toString();

    await assert.rejects(
      async () => {
        await prescriptionService.createOrUpdatePrescription({
          appointmentId: appt._id,
          doctorUserId: imposterDoctorId,
          diagnosis: "Test",
          medicines: [{ name: "Aspirin" }],
        });
      },
      {
        message: /Only the assigned doctor can create or edit prescriptions/,
      },
    );
  });

  it("7. Patient can view their own prescription; foreign patient is rejected", async () => {
    const appointmentRepo = new MockAppointmentRepo();
    const prescriptionRepo = new MockPrescriptionRepo();
    const doctorRepo = new MockDoctorRepo();
    doctorRepo.doctors.push(mockDoctor);

    const prescriptionService = new PrescriptionService(
      prescriptionRepo as any,
      appointmentRepo as any,
      doctorRepo as any,
    );

    const appt = await appointmentRepo.create({
      patient: { _id: new Types.ObjectId(patientUserId), name: "John Doe" },
      doctor: mockDoctor,
      appointmentDate: new Date(),
      timeSlot: "10:30 AM",
      status: "completed",
      consultationType: "online",
    });

    await prescriptionService.createOrUpdatePrescription({
      appointmentId: appt._id,
      doctorUserId,
      diagnosis: "Mild Migraine",
      medicines: [{ name: "Sumatriptan", dosage: "50 mg", frequency: "1 at onset", duration: "1 day", instructions: "With water" }],
    });

    // Patient views their own prescription
    const p1 = await prescriptionService.getPrescriptionByAppointment({
      appointmentId: appt._id,
      userId: patientUserId,
      userRole: "patient",
    });
    assert.ok(p1);
    assert.equal(p1.diagnosis, "Mild Migraine");

    // Other patient tries to view
    const foreignPatientId = new Types.ObjectId().toString();
    await assert.rejects(
      async () => {
        await prescriptionService.getPrescriptionByAppointment({
          appointmentId: appt._id,
          userId: foreignPatientId,
          userRole: "patient",
        });
      },
      {
        message: /You do not have permission to view this prescription/,
      },
    );
  });
});
