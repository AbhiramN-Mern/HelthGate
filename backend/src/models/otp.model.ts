import { Schema, model, type InferSchemaType } from "mongoose";

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL index: automatically deletes document when expiresAt <= current time
    },
    attempts: {
      type: Number,
      default: 0,
    },
    usedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Fast compound lookup index for latest active OTP by email
otpSchema.index({ email: 1, createdAt: -1 });

export type OTP = InferSchemaType<typeof otpSchema>;

const OTPModel = model<OTP>("OTP", otpSchema);

export default OTPModel;
