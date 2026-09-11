import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export type PaymentStatus = "PENDING" | "SUCCESS" | "FAILED" | "REFUNDED";
export type PaymentProvider = "MOCK" | "RAZORPAY";

const paymentSchema = new Schema(
  {
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      required: true,
      index: true,
    },
    patientId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: "INR",
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED"],
      default: "PENDING",
      index: true,
    },
    provider: {
      type: String,
      enum: ["MOCK", "RAZORPAY"],
      default: "MOCK",
    },
    providerOrderId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    providerPaymentId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    failureReason: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound index for patient payment history
paymentSchema.index({ patientId: 1, createdAt: -1 });
// Compound index for booking status lookup
paymentSchema.index({ bookingId: 1, status: 1 });

export type Payment = InferSchemaType<typeof paymentSchema> & {
  bookingId: Types.ObjectId;
  patientId: Types.ObjectId;
};

const PaymentModel = model<Payment>("Payment", paymentSchema);

export default PaymentModel;
