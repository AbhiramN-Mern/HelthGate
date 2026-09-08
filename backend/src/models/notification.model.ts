import { Schema, model, type InferSchemaType, type Types } from "mongoose";

const notificationSchema = new Schema(
  {
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["new_appointment", "cancellation", "rescheduled", "system", "general"],
      default: "new_appointment",
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

export type Notification = InferSchemaType<typeof notificationSchema> & {
  recipient: Types.ObjectId;
  appointment?: Types.ObjectId;
};

const NotificationModel = model<Notification>("Notification", notificationSchema);

export default NotificationModel;
