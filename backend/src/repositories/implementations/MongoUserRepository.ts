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
    return this.find({});
  }

  async find(
    filter: Record<string, unknown> = {},
    sort: Record<string, 1 | -1> = { createdAt: -1 },
    limit?: number,
    skip?: number,
  ): Promise<(User & { _id: Types.ObjectId; id: string })[]> {
    let query = UserModel.find(filter).select("-password").sort(sort);
    if (skip !== undefined && skip > 0) {
      query = query.skip(skip);
    }
    if (limit !== undefined && limit > 0) {
      query = query.limit(limit);
    }
    return (await query.exec()) as (User & { _id: Types.ObjectId; id: string })[];
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return UserModel.countDocuments(filter).exec();
  }

  async findByIdAndDelete(id: string | Types.ObjectId): Promise<any> {
    return UserModel.findByIdAndDelete(id).exec();
  }
}
