import { Schema, model, type InferSchemaType } from "mongoose";

export type WebhookEventStatus = "PROCESSING" | "PROCESSED" | "FAILED";

const webhookEventSchema = new Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    eventType: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    providerOrderId: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["PROCESSING", "PROCESSED", "FAILED"],
      default: "PROCESSING",
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
    attempts: {
      type: Number,
      default: 1,
    },
    payloadHash: {
      type: String,
      default: null,
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

webhookEventSchema.index({ status: 1, lockedUntil: 1 });

export type WebhookEvent = InferSchemaType<typeof webhookEventSchema>;

const WebhookEventModel = model<WebhookEvent>("WebhookEvent", webhookEventSchema);

export default WebhookEventModel;

