import { Types } from "mongoose";

export interface IAdminRepository {
  create(data: Record<string, unknown>): Promise<any>;
  findByUserId(userId: string | Types.ObjectId): Promise<any | null>;
  findAll(): Promise<any[]>;
}
