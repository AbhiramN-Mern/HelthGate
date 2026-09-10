import { Types } from "mongoose";
import AdminModel from "../../models/admin.model.js";
import { IAdminRepository } from "../interfaces/IAdminRepository.js";

export class MongoAdminRepository implements IAdminRepository {
  async create(data: Record<string, unknown>): Promise<any> {
    return AdminModel.create(data);
  }

  async findByUserId(userId: string | Types.ObjectId): Promise<any | null> {
    return AdminModel.findOne({ user: userId }).exec();
  }

  async findAll(): Promise<any[]> {
    return AdminModel.find().populate("user", "name email role").exec();
  }
}
