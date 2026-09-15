import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export type CallSessionStatus =
  | "ringing"
  | "active"
  | "ended"
  | "failed"
  | "cancelled"
  | "NOT_STARTED"
  | "DOCTOR_STARTED"
  | "PATIENT_JOINED"
  | "CALL_ENDED";

export type CallSessionMeetingStatus =
  | "NOT_STARTED"
  | "DOCTOR_STARTED"
  | "PATIENT_JOINED"
  | "CALL_ENDED";

const callSessionSchema = new Schema(
  {
    appointmentId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    doctorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "ringing",
        "active",
        "ended",
        "failed",
        "cancelled",
        "NOT_STARTED",
        "DOCTOR_STARTED",
        "PATIENT_JOINED",
        "CALL_ENDED",
      ],
      default: "DOCTOR_STARTED",
      index: true,
    },
    meetingStatus: {
      type: String,
      enum: ["NOT_STARTED", "DOCTOR_STARTED", "PATIENT_JOINED", "CALL_ENDED"],
      default: "DOCTOR_STARTED",
      index: true,
    },
    initiatedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    endedAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index to quickly find active sessions for an appointment
callSessionSchema.index({ appointmentId: 1, status: 1 });

export type CallSession = InferSchemaType<typeof callSessionSchema> & {
  _id: Types.ObjectId;
  appointmentId: Types.ObjectId;
  doctorId: Types.ObjectId;
  patientId: Types.ObjectId;
  initiatedBy: Types.ObjectId;
};

const CallSessionModel = model<CallSession>("CallSession", callSessionSchema);

export default CallSessionModel;
