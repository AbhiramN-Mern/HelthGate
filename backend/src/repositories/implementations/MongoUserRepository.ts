import { Types } from "mongoose";
import UserModel, { User } from "../../models/user.model.js";
import { IUserRepository } from "../interfaces/IUserRepository.js";

export class MongoUserRepository implements IUserRepository {
  async findByEmail(email: string, selectPassword = false): Promise<(User & { _id: Types.ObjectId; id: string }) | null> {
    const query = UserModel.findOne({ email });
    if (selectPassword) {
      query.select("+password");
    }
    return (await query.exec()) as (User & { _id: Types.ObjectId; id: string }) | null;
  }

  async findById(id: string | Types.ObjectId): Promise<(User & { _id: Types.ObjectId; id: string }) | null> {
    return (await UserModel.findById(id).exec()) as (User & { _id: Types.ObjectId; id: string }) | null;
  }

  async create(userData: Partial<User>): Promise<User & { _id: Types.ObjectId; id: string }> {
    const user = await UserModel.create(userData);
    return user as unknown as (User & { _id: Types.ObjectId; id: string });
  }

  async findAll(): Promise<(User & { _id: Types.ObjectId; id: string })[]> {
    return (await UserModel.find().select("-password").sort({ createdAt: -1 }).exec()) as (User & { _id: Types.ObjectId; id: string })[];
  }

  async findByIdAndDelete(id: string | Types.ObjectId): Promise<any> {
    return UserModel.findByIdAndDelete(id).exec();
  }
}
