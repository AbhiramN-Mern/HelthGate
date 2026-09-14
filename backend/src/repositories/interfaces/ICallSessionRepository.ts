import type { Types } from "mongoose";
import type { CallSession } from "../../models/callSession.model.js";

export interface ICallSessionRepository {
  create(data: {
    appointmentId: string | Types.ObjectId;
    doctorId: string | Types.ObjectId;
    patientId: string | Types.ObjectId;
    roomId: string;
    status?: "ringing" | "active" | "ended" | "failed" | "cancelled";
    initiatedBy: string | Types.ObjectId;
    startedAt?: Date | null;
  }): Promise<CallSession>;

  findById(id: string | Types.ObjectId): Promise<CallSession | null>;

  findByRoomId(roomId: string): Promise<CallSession | null>;

  findActiveByAppointment(
    appointmentId: string | Types.ObjectId,
  ): Promise<CallSession | null>;

  updateStatus(
    id: string | Types.ObjectId,
    status: "ringing" | "active" | "ended" | "failed" | "cancelled",
    extra?: Record<string, unknown>,
  ): Promise<CallSession | null>;

  endActiveSessionsForAppointment(
    appointmentId: string | Types.ObjectId,
  ): Promise<void>;
}
