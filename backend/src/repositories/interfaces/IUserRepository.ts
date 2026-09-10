import { Types } from "mongoose";
import { User } from "../../models/user.model.js";

export interface IUserRepository {
  findByEmail(email: string, selectPassword?: boolean): Promise<(User & { _id: Types.ObjectId; id: string }) | null>;
  findById(id: string | Types.ObjectId): Promise<(User & { _id: Types.ObjectId; id: string }) | null>;
  create(userData: Partial<User>): Promise<User & { _id: Types.ObjectId; id: string }>;
  findAll(): Promise<(User & { _id: Types.ObjectId; id: string })[]>;
  findByIdAndDelete(id: string | Types.ObjectId): Promise<any>;
}
