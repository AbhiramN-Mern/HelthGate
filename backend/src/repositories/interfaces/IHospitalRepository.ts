import { Types } from "mongoose";
import { IHospital } from "../../models/hospital.model.js";

export interface IHospitalRepository {
  find(filter?: Record<string, unknown>, sort?: Record<string, 1 | -1>): Promise<any[]>;
  findById(id: string | Types.ObjectId): Promise<any | null>;
  create(hospitalData: Partial<IHospital>): Promise<any>;
  findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null>;
  toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
