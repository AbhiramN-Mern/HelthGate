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
    hospitalDoctor: {
      type: Schema.Types.ObjectId,
      ref: "HospitalDoctor",
      default: null,
    },
    department: {
      type: String,
      trim: true,
      default: "",
    },
    isHospitalAppointment: {
      type: Boolean,
      default: false,
    },
    appointmentDate: {
      type: Date,
      required: true,
      validate: [
        {
          validator: function (v: Date) {
            if (!v) return false;
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            return v >= startOfToday;
          },
          message: "Cannot book an appointment on a past date.",
        },
        {
          validator: function (v: Date) {
            if (!v) return false;
            const maxDays = Number(process.env.MAX_BOOKING_DAYS_AHEAD) || 90;
            const maxDate = new Date();
            maxDate.setDate(maxDate.getDate() + maxDays);
            maxDate.setHours(23, 59, 59, 999);
            return v <= maxDate;
          },
          message: "Appointments can only be booked up to 90 days in advance.",
        },
      ],
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
    rescheduleRequest: {
      status: {
        type: String,
        enum: ["pending", "accepted", "declined", "none"],
        default: "none",
      },
      proposedDate: {
        type: Date,
        default: null,
      },
      proposedTimeSlot: {
        type: String,
        trim: true,
        default: null,
      },
      reason: {
        type: String,
        trim: true,
        default: null,
      },
      requestedBy: {
        type: String,
        enum: ["doctor", "patient"],
        default: "doctor",
      },
      requestedAt: {
        type: Date,
        default: null,
      },
      respondedAt: {
        type: Date,
        default: null,
      },
    },
  },
  {
    timestamps: true,
  },
);

export type Appointment = InferSchemaType<typeof appointmentSchema> & {
  patient: Types.ObjectId;
  doctor: Types.ObjectId;
  hospital?: Types.ObjectId | null;
  hospitalDoctor?: Types.ObjectId | null;
  department?: string;
  isHospitalAppointment?: boolean;
};

const AppointmentModel = model<Appointment>("Appointment", appointmentSchema);

export default AppointmentModel;
