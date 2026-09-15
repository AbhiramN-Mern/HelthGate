import { Types } from "mongoose";
import OTPModel from "../../models/otp.model.js";
import { IOTPRepository, OTPDocument } from "../interfaces/IOTPRepository.js";

export class MongoOTPRepository implements IOTPRepository {
  async create(data: {
    email: string;
    otpHash: string;
    expiresAt: Date;
  }): Promise<OTPDocument> {
    const record = await OTPModel.create({
      email: data.email.toLowerCase().trim(),
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      attempts: 0,
      usedAt: null,
    });
    return record as unknown as OTPDocument;
  }

  async findLatestByEmail(email: string): Promise<OTPDocument | null> {
    const record = await OTPModel.findOne({
      email: email.toLowerCase().trim(),
    })
      .sort({ createdAt: -1 })
      .exec();

    return record as unknown as OTPDocument | null;
  }

  async incrementAttempts(id: string | Types.ObjectId): Promise<OTPDocument | null> {
    const record = await OTPModel.findByIdAndUpdate(
      id,
      { $inc: { attempts: 1 } },
      { new: true }
    ).exec();

    return record as unknown as OTPDocument | null;
  }

  async markAsUsed(id: string | Types.ObjectId): Promise<OTPDocument | null> {
    const record = await OTPModel.findByIdAndUpdate(
      id,
      { $set: { usedAt: new Date() } },
      { new: true }
    ).exec();

    return record as unknown as OTPDocument | null;
  }

  async deleteByEmail(email: string): Promise<void> {
    await OTPModel.deleteMany({ email: email.toLowerCase().trim() }).exec();
  }

  async deleteById(id: string | Types.ObjectId): Promise<void> {
    await OTPModel.findByIdAndDelete(id).exec();
  }
}
