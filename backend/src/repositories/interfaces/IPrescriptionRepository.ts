import type { Types } from "mongoose";
import type { Prescription } from "../../models/prescription.model.js";

export interface CreatePrescriptionDto {
  appointment: string | Types.ObjectId;
  patient: string | Types.ObjectId;
  doctor: string | Types.ObjectId;
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  labTests?: string[];
  additionalAdvice?: string;
  followUpDate?: Date | null;
}

export interface IPrescriptionRepository {
  create(data: CreatePrescriptionDto): Promise<Prescription>;
  findById(id: string | Types.ObjectId): Promise<Prescription | null>;
  findByAppointmentId(
    appointmentId: string | Types.ObjectId,
    populate?: boolean,
  ): Promise<Prescription | null>;
  findByPatientId(
    patientId: string | Types.ObjectId,
    limit?: number,
    skip?: number,
  ): Promise<Prescription[]>;
  findByDoctorId(
    doctorId: string | Types.ObjectId,
    limit?: number,
    skip?: number,
  ): Promise<Prescription[]>;
  updateByAppointmentId(
    appointmentId: string | Types.ObjectId,
    data: Partial<CreatePrescriptionDto>,
  ): Promise<Prescription | null>;
  count(filter: Record<string, unknown>): Promise<number>;
}
