import type { Types } from "mongoose";
import CallSessionModel, {
  type CallSession,
  type CallSessionStatus,
  type CallSessionMeetingStatus,
} from "../../models/callSession.model.js";
import type { ICallSessionRepository } from "../interfaces/ICallSessionRepository.js";

export class MongoCallSessionRepository implements ICallSessionRepository {
  async create(data: {
    appointmentId: string | Types.ObjectId;
    doctorId: string | Types.ObjectId;
    patientId: string | Types.ObjectId;
    roomId: string;
    status?: CallSessionStatus;
    meetingStatus?: CallSessionMeetingStatus;
    initiatedBy: string | Types.ObjectId;
    startedAt?: Date | null;
  }): Promise<CallSession> {
    const session = await CallSessionModel.create(data);
    return session.toObject() as CallSession;
  }

  async findById(id: string | Types.ObjectId): Promise<CallSession | null> {
    const session = await CallSessionModel.findById(id).exec();
    return session ? (session.toObject() as CallSession) : null;
  }

  async findByRoomId(roomId: string): Promise<CallSession | null> {
    const session = await CallSessionModel.findOne({ roomId }).exec();
    return session ? (session.toObject() as CallSession) : null;
  }

  async findActiveByAppointment(
    appointmentId: string | Types.ObjectId,
  ): Promise<CallSession | null> {
    const session = await CallSessionModel.findOne({
      appointmentId,
      status: {
        $in: ["ringing", "active", "DOCTOR_STARTED", "PATIENT_JOINED"],
      },
    })
      .sort({ createdAt: -1 })
      .exec();
    return session ? (session.toObject() as CallSession) : null;
  }

  async updateStatus(
    id: string | Types.ObjectId,
    status: CallSessionStatus,
    extra: Record<string, unknown> = {},
  ): Promise<CallSession | null> {
    const updatePayload: Record<string, unknown> = {
      status,
      ...extra,
    };

    const session = await CallSessionModel.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true },
    ).exec();

    return session ? (session.toObject() as CallSession) : null;
  }

  async endActiveSessionsForAppointment(
    appointmentId: string | Types.ObjectId,
  ): Promise<void> {
    await CallSessionModel.updateMany(
      {
        appointmentId,
        status: {
          $in: ["ringing", "active", "DOCTOR_STARTED", "PATIENT_JOINED"],
        },
      },
      {
        $set: {
          status: "ended",
          endedAt: new Date(),
        },
      },
    ).exec();
  }
}
