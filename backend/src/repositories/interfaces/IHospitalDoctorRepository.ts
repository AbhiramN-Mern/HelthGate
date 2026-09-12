import { Types } from "mongoose";

export interface IHospitalDoctorRepository {
  find(
    filter: Record<string, unknown>,
    populate?: any,
    sort?: Record<string, 1 | -1>,
    limit?: number,
    skip?: number,
  ): Promise<any[]>;
  findOne(filter: Record<string, unknown>): Promise<any | null>;
  findById(id: string | Types.ObjectId, populate?: any): Promise<any | null>;
  create(data: Record<string, unknown>): Promise<any>;
  findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null>;
  updateAssociationStatus(
    id: string | Types.ObjectId,
    status: "ACTIVE" | "PENDING" | "REJECTED" | "REMOVED",
    extraFields?: Record<string, unknown>,
  ): Promise<any | null>;
  upsertActiveAssociation(
    doctorId: string | Types.ObjectId,
    hospitalId: string | Types.ObjectId,
    department: string,
  ): Promise<any>;
  aggregate(pipeline: any[]): Promise<any[]>;
  distinct(field: string, filter: Record<string, unknown>): Promise<any[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
