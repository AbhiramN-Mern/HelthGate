import { Types } from "mongoose";
import { Appointment } from "../../models/appointment.model.js";

export interface IAppointmentRepository {
  create(appointmentData: Partial<Appointment> & Record<string, unknown>): Promise<any>;
  findById(id: string | Types.ObjectId, populateDetails?: boolean): Promise<any | null>;
  findOne(filter: Record<string, unknown>, populateDetails?: boolean): Promise<any | null>;
  find(
    filter: Record<string, unknown>,
    populateDetails?: boolean,
    sort?: Record<string, 1 | -1>,
    select?: string,
    limit?: number,
    skip?: number,
  ): Promise<any[]>;
  findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null>;
  updateStatus(id: string | Types.ObjectId, status: string): Promise<any | null>;
  updateRescheduleRequest(id: string | Types.ObjectId, rescheduleRequest: Record<string, unknown>): Promise<any | null>;
  applyReschedule(
    id: string | Types.ObjectId,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: Record<string, unknown>,
  ): Promise<any | null>;
  count(filter?: Record<string, unknown>): Promise<number>;
  aggregate(pipeline: any[]): Promise<any[]>;
}
