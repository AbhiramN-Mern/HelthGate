import { Types } from "mongoose";
import { Patient } from "../../models/patient.model.js";

export interface IPatientRepository {
  findByUserId(userId: string | Types.ObjectId, populateUser?: boolean): Promise<any | null>;
  findById(id: string | Types.ObjectId, populateUser?: boolean): Promise<any | null>;
  create(patientData: Partial<Patient>): Promise<any>;
  updateByUserId(userId: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null>;
  updateById(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null>;
  toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null>;
  findAll(populateUser?: boolean): Promise<any[]>;
  find(
    filter?: Record<string, unknown>,
    populateUser?: boolean,
    sort?: Record<string, 1 | -1>,
    limit?: number,
    skip?: number,
  ): Promise<any[]>;
  count(filter?: Record<string, unknown>): Promise<number>;
}
