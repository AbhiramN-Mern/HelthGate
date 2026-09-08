import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const doctorSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    specialization: {
      type: String,
      required: true,
      trim: true,
    },
    qualification: {
      type: String,
      required: true,
      trim: true,
    },
    hospital: {
      type: Schema.Types.ObjectId,
      ref: "Hospital",
      default: null,
    },
    profileImage: {
      type: String,
      default: "",
    },
    experienceYears: {
      type: Number,
      default: 0,
      min: 0,
    },
    licenseNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    consultationFee: {
      type: Number,
      default: 0,
      min: 0,
    },
    active: {
      type: Boolean,
      default: true,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    available: {
      type: Boolean,
      default: true,
    },
    availability: {
      workingDays: {
        type: [String],
        default: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      },
      workingHours: {
        start: { type: String, default: "09:00 AM" },
        end: { type: String, default: "05:00 PM" },
      },
      availableSlots: {
        type: [String],
        default: ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"],
      },
      blockedDates: {
        type: [String],
        default: [],
      },
    },
  },
  {
    timestamps: true,
  },
);

export type Doctor = InferSchemaType<typeof doctorSchema> & {
  user: Types.ObjectId;
};

const DoctorModel = model<Doctor>("Doctor", doctorSchema);

export default DoctorModel;
