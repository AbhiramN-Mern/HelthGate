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
      enum: [
        "pending_payment",
        "PENDING_PAYMENT",
        "scheduled",
        "confirmed",
        "CONFIRMED",
        "completed",
        "cancelled",
      ],
      default: "pending_payment",
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
    consultationType: {
      type: String,
      enum: ["online", "offline"],
      default: "online",
      required: true,
    },
    tokenNumber: {
      type: String,
      trim: true,
      default: null,
    },
    cabinNumber: {
      type: String,
      trim: true,
      default: null,
    },
    actualStartTime: {
      type: Date,
      default: null,
    },
    startedEarly: {
      type: Boolean,
      default: false,
    },
    videoCall: {
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
      roomId: {
        type: String,
        default: null,
      },
      meetingStatus: {
        type: String,
        enum: ["NOT_STARTED", "DOCTOR_STARTED", "PATIENT_JOINED", "CALL_ENDED"],
        default: "NOT_STARTED",
      },
      enabled: {
        type: Boolean,
        default: false,
      },
    },
    rescheduleRequest: {
      status: {
        type: String,
        enum: ["pending", "accepted", "declined", "none"],
        default: "none",
      },
      approvalStatus: {
        type: String,
        enum: ["pending_patient_approval", "approved", "rejected", "not_required", "none"],
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
        enum: ["doctor", "patient", "admin"],
        default: "doctor",
      },
      requestedByRole: {
        type: String,
        enum: ["doctor", "patient", "admin"],
        default: "doctor",
      },
      requestedByUser: {
        type: Schema.Types.ObjectId,
        ref: "User",
        default: null,
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
    cancellationReason: {
      type: String,
      trim: true,
      default: null,
    },
    cancelledBy: {
      type: String,
      enum: ["doctor", "patient", "admin", "system"],
      default: null,
    },
    cancelledByUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    actionHistory: [
      {
        action: {
          type: String,
          required: true,
        },
        initiatedBy: {
          type: Schema.Types.ObjectId,
          ref: "User",
          default: null,
        },
        initiatedByRole: {
          type: String,
          enum: ["doctor", "admin", "patient", "system"],
          required: true,
        },
        approvalStatus: {
          type: String,
          enum: ["pending_patient_approval", "approved", "rejected", "not_required", "none"],
          default: "none",
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
        details: {
          type: Schema.Types.Mixed,
          default: {},
        },
      },
    ],
  },
  {
    timestamps: true,
  },
);

// High-performance compound indexes for slot availability, schedule queries, and patient isolation
appointmentSchema.index({ doctor: 1, appointmentDate: 1, timeSlot: 1, status: 1 });
appointmentSchema.index({ patient: 1, appointmentDate: -1 });
appointmentSchema.index({ status: 1 });
appointmentSchema.index({ "videoCall.roomId": 1 });

export type Appointment = InferSchemaType<typeof appointmentSchema> & {
  patient: Types.ObjectId;
  doctor: Types.ObjectId;
  hospital?: Types.ObjectId | null;
  hospitalDoctor?: Types.ObjectId | null;
  department?: string;
  isHospitalAppointment?: boolean;
  tokenNumber?: string | null;
  cabinNumber?: string | null;
};

const AppointmentModel = model<Appointment>("Appointment", appointmentSchema);

export default AppointmentModel;

