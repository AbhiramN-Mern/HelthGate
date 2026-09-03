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
