import { Types } from "mongoose";

export interface INotificationRepository {
  create(data: {
    recipient: string | Types.ObjectId;
    type: string;
    title: string;
    message: string;
    appointment?: string | Types.ObjectId;
  }): Promise<any>;
  findByRecipient(recipientId: string | Types.ObjectId, limit?: number): Promise<any[]>;
  markAsRead(notificationId: string | Types.ObjectId, recipientId: string | Types.ObjectId): Promise<any | null>;
}
