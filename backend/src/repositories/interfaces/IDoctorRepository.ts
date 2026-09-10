import { Types } from "mongoose";
import { Doctor } from "../../models/doctor.model.js";

export interface IDoctorRepository {
  findByUserId(userId: string | Types.ObjectId, populateDetails?: boolean): Promise<any | null>;
  findById(id: string | Types.ObjectId, populateDetails?: boolean): Promise<any | null>;
  findByLicenseNumber(licenseNumber: string): Promise<any | null>;
  create(doctorData: Partial<Doctor>): Promise<any>;
  updateByUserId(userId: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null>;
  updateById(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null>;
  toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null>;
  deleteById(id: string | Types.ObjectId): Promise<any>;
  find(filter: Record<string, unknown>, populateDetails?: boolean, sort?: Record<string, 1 | -1>): Promise<any[]>;
  distinctSpecializations(): Promise<string[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
