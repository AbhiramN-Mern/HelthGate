import { Schema, model, type InferSchemaType } from "mongoose";

export type OutboxEventStatus = "PENDING" | "PROCESSING" | "PROCESSED" | "FAILED";
export type OutboxEventType =
  | "APPOINTMENT_CONFIRMED"
  | "PAYMENT_REFUNDED"
  | "APPOINTMENT_CANCELLED";

const outboxEventSchema = new Schema(
  {
    aggregateType: {
      type: String,
      required: true,
      enum: ["PAYMENT", "APPOINTMENT"],
      index: true,
    },
    aggregateId: {
      type: String,
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      enum: ["APPOINTMENT_CONFIRMED", "PAYMENT_REFUNDED", "APPOINTMENT_CANCELLED"],
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: ["PENDING", "PROCESSING", "PROCESSED", "FAILED"],
      default: "PENDING",
      index: true,
    },
    leaseToken: {
      type: String,
      default: null,
    },
    lockedUntil: {
      type: Date,
      default: null,
    },
    retryCount: {
      type: Number,
      default: 0,
    },
    maxRetries: {
      type: Number,
      default: 5,
    },
    nextRetryAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    lastError: {
      type: String,
      default: null,
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

outboxEventSchema.index({ status: 1, nextRetryAt: 1, lockedUntil: 1 });
outboxEventSchema.index({ aggregateId: 1, eventType: 1 });

export type OutboxEvent = InferSchemaType<typeof outboxEventSchema>;

const OutboxEventModel = model<OutboxEvent>("OutboxEvent", outboxEventSchema);

export default OutboxEventModel;

