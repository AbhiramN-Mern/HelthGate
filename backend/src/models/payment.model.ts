import { Schema, model, type InferSchemaType, type Types } from "mongoose";

export type PaymentStatus =
  | "PENDING"
  | "SUCCESS"
  | "FAILED"
  | "REFUND_REQUESTED"
  | "REFUND_PENDING"
  | "REFUNDED"
  | "REFUND_FAILED";

export type PaymentProvider = "MOCK" | "RAZORPAY";
export type RefundStatus = "NONE" | "REQUESTED" | "PENDING" | "PROCESSED" | "FAILED";

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
      enum: [
        "PENDING",
        "SUCCESS",
        "FAILED",
        "REFUND_REQUESTED",
        "REFUND_PENDING",
        "REFUNDED",
        "REFUND_FAILED",
      ],
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
    },
    providerPaymentId: {
      type: String,
      default: null,
      trim: true,
    },
    failureReason: {
      type: String,
      default: null,
      trim: true,
    },
    refundId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    refundStatus: {
      type: String,
      enum: ["NONE", "REQUESTED", "PENDING", "PROCESSED", "FAILED"],
      default: "NONE",
      index: true,
    },
    refundIdempotencyKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    refundPayload: {
      type: Schema.Types.Mixed,
      default: null,
    },
    refundedAt: {
      type: Date,
      default: null,
    },
    reconciliationNotes: {
      type: String,
      default: null,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);

// Unique index for providerOrderId
paymentSchema.index(
  { providerOrderId: 1 },
  { unique: true, name: "unique_provider_order_id" }
);

// Partial unique index for providerPaymentId (only when non-null and non-empty string)
paymentSchema.index(
  { providerPaymentId: 1 },
  {
    unique: true,
    partialFilterExpression: { providerPaymentId: { $type: "string", $gt: "" } },
    name: "unique_provider_payment_id",
  }
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
