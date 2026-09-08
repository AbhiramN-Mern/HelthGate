import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const appointmentSchema = new Schema(
  {
    patient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    doctor: {
      type: Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    appointmentDate: {
      type: Date,
      required: true,
    },
    timeSlot: {
      type: String,
      default: "10:00 AM",
      trim: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "confirmed", "completed", "cancelled"],
      default: "scheduled",
    },
    reason: {
      type: String,
      trim: true,
      default: "General Consultation",
    },
    type: {
      type: String,
      enum: ["In-Person", "Video", "Follow-up"],
      default: "In-Person",
    },
  },
  {
    timestamps: true,
  },
);

export type Appointment = InferSchemaType<typeof appointmentSchema> & {
  patient: Types.ObjectId;
  doctor: Types.ObjectId;
  hospital?: Types.ObjectId;
};

const AppointmentModel = model<Appointment>("Appointment", appointmentSchema);

export default AppointmentModel;
