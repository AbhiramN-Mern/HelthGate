import { Types } from "mongoose";

export interface INotificationRepository {
  create(data: {
    recipient: string | Types.ObjectId;
    type: string;
    title: string;
    message: string;
    appointment?: string | Types.ObjectId;
    callSession?: string | Types.ObjectId;
  }): Promise<any>;
  findByRecipient(recipientId: string | Types.ObjectId, limit?: number, skip?: number): Promise<any[]>;
  find(
    filter?: Record<string, unknown>,
    sort?: Record<string, 1 | -1>,
    limit?: number,
    skip?: number,
  ): Promise<any[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
  markAsRead(notificationId: string | Types.ObjectId, recipientId: string | Types.ObjectId): Promise<any | null>;
}
