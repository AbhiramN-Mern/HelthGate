import { Types } from "mongoose";
import NotificationModel from "../../models/notification.model.js";
import { INotificationRepository } from "../interfaces/INotificationRepository.js";

export class MongoNotificationRepository implements INotificationRepository {
  async create(data: {
    recipient: string | Types.ObjectId;
    type: string;
    title: string;
    message: string;
    appointment?: string | Types.ObjectId;
  }): Promise<any> {
    return NotificationModel.create(data as any);
  }

  async findByRecipient(recipientId: string | Types.ObjectId, limit = 30, skip?: number): Promise<any[]> {
    let query = NotificationModel.find({ recipient: recipientId }).sort({ createdAt: -1 });
    if (skip !== undefined && skip > 0) {
      query = query.skip(skip);
    }
    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }
    return query.exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return NotificationModel.countDocuments(filter).exec();
  }

  async markAsRead(notificationId: string | Types.ObjectId, recipientId: string | Types.ObjectId): Promise<any | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipient: recipientId },
      { $set: { isRead: true } },
      { new: true },
    ).exec();
  }
}
