import { Types } from "mongoose";
import { OTP } from "../../models/otp.model.js";

export type OTPDocument = OTP & { _id: Types.ObjectId; id: string; createdAt: Date; updatedAt: Date };

export interface IOTPRepository {
  create(data: {
    email: string;
    otpHash: string;
    expiresAt: Date;
  }): Promise<OTPDocument>;

  findLatestByEmail(email: string): Promise<OTPDocument | null>;

  incrementAttempts(id: string | Types.ObjectId): Promise<OTPDocument | null>;

  markAsUsed(id: string | Types.ObjectId): Promise<OTPDocument | null>;

  deleteByEmail(email: string): Promise<void>;

  deleteById(id: string | Types.ObjectId): Promise<void>;
}
