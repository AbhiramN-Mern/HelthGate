import { Types } from "mongoose";
import AppointmentModel, { Appointment } from "../../models/appointment.model.js";
import { IAppointmentRepository } from "../interfaces/IAppointmentRepository.js";

export class MongoAppointmentRepository implements IAppointmentRepository {
  private applyStandardPopulate(query: any) {
    return query
      .populate({
        path: "doctor",
        populate: [
          { path: "user", select: "name email role" },
          { path: "hospital", select: "name isActive" },
        ],
      })
      .populate("hospital", "name isActive licenseNumber address contactInfo departments")
      .populate("hospitalDoctor")
      .populate("patient", "name email");
  }

  async create(appointmentData: Partial<Appointment> & Record<string, unknown>): Promise<any> {
    return AppointmentModel.create(appointmentData);
  }

  async findById(id: string | Types.ObjectId, populateDetails = true): Promise<any | null> {
    let query = AppointmentModel.findById(id);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findOne(filter: Record<string, unknown>, populateDetails = true): Promise<any | null> {
    let query = AppointmentModel.findOne(filter);
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async find(
    filter: Record<string, unknown>,
    populateDetails = false,
    sort: Record<string, 1 | -1> = { appointmentDate: 1 },
    select?: string,
  ): Promise<any[]> {
    let query = AppointmentModel.find(filter).sort(sort);
    if (select) {
      query = query.select(select) as any;
    }
    if (populateDetails) {
      query = this.applyStandardPopulate(query);
    }
    return query.exec();
  }

  async findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updateStatus(id: string | Types.ObjectId, status: string): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(id, { $set: { status } }, { new: true }).exec();
  }

  async updateRescheduleRequest(
    id: string | Types.ObjectId,
    rescheduleRequest: Record<string, unknown>,
  ): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(
      id,
      { $set: { rescheduleRequest } },
      { new: true },
    ).exec();
  }

  async applyReschedule(
    id: string | Types.ObjectId,
    appointmentDate: Date,
    timeSlot: string,
    rescheduleRequest: Record<string, unknown>,
  ): Promise<any | null> {
    return AppointmentModel.findByIdAndUpdate(
      id,
      {
        $set: {
          appointmentDate,
          timeSlot,
          status: "confirmed",
          rescheduleRequest,
        },
      },
      { new: true },
    ).exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return AppointmentModel.countDocuments(filter).exec();
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return AppointmentModel.aggregate(pipeline).exec();
  }
}
