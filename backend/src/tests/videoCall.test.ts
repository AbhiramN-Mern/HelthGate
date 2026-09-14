import test from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { VideoCallService } from "../services/videoCall.service.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors/AppError.js";

// In-memory mock appointment repository for unit testing
class MockAppointmentRepo {
  public appointments: Map<string, any> = new Map();

  async findById(id: any, populateDetails = true) {
    const key = id.toString();
    const appt = this.appointments.get(key);
    return appt ? JSON.parse(JSON.stringify(appt)) : null;
  }

  async findByIdAndUpdate(id: any, update: any) {
    const key = id.toString();
    const appt = this.appointments.get(key);
    if (!appt) return null;

    for (const [k, v] of Object.entries(update)) {
      if (k.startsWith("videoCall.")) {
        const subKey = k.replace("videoCall.", "");
        appt.videoCall = appt.videoCall || {};
        appt.videoCall[subKey] = v;
      } else {
        appt[k] = v;
      }
    }
    this.appointments.set(key, appt);
    return JSON.parse(JSON.stringify(appt));
  }
}

test("Video Consultation Authorization & Service Tests", async (t) => {
  const repo = new MockAppointmentRepo();
  const service = new VideoCallService(repo as any);

  const patientUserId = new Types.ObjectId().toString();
  const doctorUserId = new Types.ObjectId().toString();
  const doctorId = new Types.ObjectId().toString();
  const unauthorizedUserId = new Types.ObjectId().toString();

  const appointmentId = new Types.ObjectId().toString();

  repo.appointments.set(appointmentId, {
    _id: appointmentId,
    patient: { _id: patientUserId, name: "Alice Patient", email: "alice@example.com" },
    doctor: {
      _id: doctorId,
      specialization: "Cardiology",
      user: { _id: doctorUserId, name: "Dr. Gregory House", email: "house@example.com" },
    },
    appointmentDate: new Date(),
    timeSlot: "10:00 AM",
    status: "confirmed",
    type: "Video",
    videoCall: {
      enabled: true,
      roomId: null,
      startedAt: null,
      endedAt: null,
      duration: 0,
    },
  });

  await t.test("1. Patient assigned to appointment can successfully validate access and generate roomId", async () => {
    const session = await service.validateCallAccess({
      appointmentId,
      userId: patientUserId,
      bypassTimeCheck: true,
    });

    assert.equal(session.userRole, "patient");
    assert.equal(session.appointmentId, appointmentId);
    assert.ok(session.roomId.startsWith("room-"));
    assert.equal(session.doctorName, "Dr. Gregory House");
    assert.equal(session.patientName, "Alice Patient");
    assert.ok(Array.isArray(session.iceServers));
    assert.ok(session.iceServers.length > 0);
  });

  await t.test("2. Doctor assigned to appointment can successfully validate access", async () => {
    const session = await service.validateCallAccess({
      appointmentId,
      userId: doctorUserId,
      bypassTimeCheck: true,
    });

    assert.equal(session.userRole, "doctor");
    assert.equal(session.appointmentId, appointmentId);
  });

  await t.test("3. Unauthorized user is rejected with ForbiddenError (403)", async () => {
    await assert.rejects(
      async () => {
        await service.validateCallAccess({
          appointmentId,
          userId: unauthorizedUserId,
          bypassTimeCheck: true,
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError);
        assert.equal(err.statusCode, 403);
        return true;
      },
    );
  });

  await t.test("4. Cancelled appointment is rejected", async () => {
    const cancelledApptId = new Types.ObjectId().toString();
    repo.appointments.set(cancelledApptId, {
      _id: cancelledApptId,
      patient: { _id: patientUserId, name: "Alice" },
      doctor: { user: { _id: doctorUserId, name: "Doctor" } },
      status: "cancelled",
      videoCall: { enabled: true },
    });

    await assert.rejects(
      async () => {
        await service.validateCallAccess({
          appointmentId: cancelledApptId,
          userId: patientUserId,
          bypassTimeCheck: true,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /cancelled/i);
        return true;
      },
    );
  });

  await t.test("5. Pending payment appointment is rejected", async () => {
    const unpaidApptId = new Types.ObjectId().toString();
    repo.appointments.set(unpaidApptId, {
      _id: unpaidApptId,
      patient: { _id: patientUserId, name: "Alice" },
      doctor: { user: { _id: doctorUserId, name: "Doctor" } },
      status: "pending_payment",
      videoCall: { enabled: true },
    });

    await assert.rejects(
      async () => {
        await service.validateCallAccess({
          appointmentId: unpaidApptId,
          userId: patientUserId,
          bypassTimeCheck: true,
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /pending/i);
        return true;
      },
    );
  });

  await t.test("6. Non-existent appointment throws NotFoundError (404)", async () => {
    await assert.rejects(
      async () => {
        await service.validateCallAccess({
          appointmentId: new Types.ObjectId().toString(),
          userId: patientUserId,
        });
      },
      (err: any) => {
        assert.ok(err instanceof NotFoundError);
        assert.equal(err.statusCode, 404);
        return true;
      },
    );
  });

  await t.test("7. Call start records startedAt date", async () => {
    await service.recordCallStart(appointmentId);
    const updated = repo.appointments.get(appointmentId);
    assert.ok(updated.videoCall.startedAt instanceof Date);
  });

  await t.test("8. Call end calculates duration and records endedAt", async () => {
    const endResult = await service.recordCallEnd({
      appointmentId,
      endedByUserId: doctorUserId,
    });

    assert.equal(endResult.success, true);
    assert.ok(typeof endResult.duration === "number");
    assert.ok(endResult.endedAt instanceof Date);

    const updated = repo.appointments.get(appointmentId);
    assert.equal(updated.status, "completed");
    assert.ok(updated.videoCall.duration >= 0);
  });

  await t.test("9. CRITICAL: Doctor can start video call at ANY TIME before appointment date/time", async () => {
    // Appointment scheduled 7 days in the future at 6:00 PM
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 7);
    const futureApptId = new Types.ObjectId().toString();

    repo.appointments.set(futureApptId, {
      _id: futureApptId,
      patient: { _id: patientUserId, name: "Alice Patient", email: "alice@example.com" },
      doctor: {
        _id: doctorId,
        specialization: "Cardiology",
        user: { _id: doctorUserId, name: "Dr. Gregory House", email: "house@example.com" },
      },
      appointmentDate: futureDate,
      timeSlot: "06:00 PM",
      status: "confirmed",
      type: "Video",
    });

    // In-memory mock call session repo
    const mockSessions: any[] = [];
    const mockSessionRepo: any = {
      findActiveByAppointment: async (id: any) => mockSessions.find(s => s.appointmentId === id.toString() && ["ringing", "active"].includes(s.status)) || null,
      create: async (data: any) => {
        const s = { _id: new Types.ObjectId(), ...data, appointmentId: data.appointmentId.toString(), status: data.status || "ringing" };
        mockSessions.push(s);
        return s;
      },
      findById: async (id: any) => mockSessions.find(s => s._id.toString() === id.toString()) || null,
      updateStatus: async (id: any, status: string, extra: any) => {
        const s = mockSessions.find(s => s._id.toString() === id.toString());
        if (s) {
          s.status = status;
          Object.assign(s, extra);
        }
        return s;
      },
    };

    const sessionService = new VideoCallService(repo as any, mockSessionRepo);

    // Call start at current time (hours/days before future appointment)
    const result = await sessionService.startConsultationCall({
      appointmentId: futureApptId,
      doctorUserId,
    });

    assert.equal(result.userRole, "doctor");
    assert.ok(result.callSession.id);
    assert.equal(result.callSession.status, "ringing");
    assert.ok(result.roomId.startsWith("room-"));

    // Verify duplicate prevention: calling start again returns the same active session
    const duplicateResult = await sessionService.startConsultationCall({
      appointmentId: futureApptId,
      doctorUserId,
    });
    assert.equal(duplicateResult.callSession.id, result.callSession.id);
    assert.equal(mockSessions.length, 1, "Must NOT create duplicate CallSession");

    // Patient joins active call
    const joinResult = await sessionService.joinConsultationCall({
      callSessionId: result.callSession.id,
      patientUserId,
    });
    assert.equal(joinResult.callSession.status, "active");
    assert.equal(joinResult.userRole, "patient");
  });

  await t.test("10. Metered ICE server resolver returns STUN and TURN configurations safely", async () => {
    const iceServers = await service.getIceServers();
    assert.ok(Array.isArray(iceServers));
    assert.ok(iceServers.length > 0);
    // Ensure no sensitive API keys are exposed
    const stringified = JSON.stringify(iceServers);
    assert.ok(!stringified.includes("METERED_API_KEY"));
  });
});
