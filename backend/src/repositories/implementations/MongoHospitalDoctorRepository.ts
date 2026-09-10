 import { Types } from "mongoose";
import HospitalDoctorModel from "../../models/hospitalDoctor.model.js";
import { IHospitalDoctorRepository } from "../interfaces/IHospitalDoctorRepository.js";

export class MongoHospitalDoctorRepository implements IHospitalDoctorRepository {
  async find(filter: Record<string, unknown>, populate?: any, sort: Record<string, 1 | -1> = { updatedAt: -1 }): Promise<any[]> {
    let query = HospitalDoctorModel.find(filter).sort(sort);
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach((p) => {
          query = query.populate(p) as any;
        });
      } else {
        query = query.populate(populate) as any;
      }
    }
    return query.exec();
  }

  async findOne(filter: Record<string, unknown>): Promise<any | null> {
    return HospitalDoctorModel.findOne(filter).exec();
  }

  async findById(id: string | Types.ObjectId, populate?: any): Promise<any | null> {
    let query = HospitalDoctorModel.findById(id);
    if (populate) {
      if (Array.isArray(populate)) {
        populate.forEach((p) => {
          query = query.populate(p) as any;
        });
      } else {
        query = query.populate(populate) as any;
      }
    }
    return query.exec();
  }

  async create(data: Record<string, unknown>): Promise<any> {
    return HospitalDoctorModel.create(data);
  }

  async findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null> {
    return HospitalDoctorModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async updateAssociationStatus(
    id: string | Types.ObjectId,
    status: "ACTIVE" | "PENDING" | "REJECTED" | "REMOVED",
    extraFields: Record<string, unknown> = {},
  ): Promise<any | null> {
    return HospitalDoctorModel.findByIdAndUpdate(
      id,
      { $set: { status, ...extraFields } },
      { new: true },
    ).exec();
  }

  async upsertActiveAssociation(
    doctorId: string | Types.ObjectId,
    hospitalId: string | Types.ObjectId,
    department: string,
  ): Promise<any> {
    const existing = await HospitalDoctorModel.findOne({ doctor: doctorId, hospital: hospitalId });
    if (existing) {
      existing.status = "ACTIVE";
      existing.department = String(department).trim();
      existing.requestedBy = "ADMIN";
      existing.joinedAt = new Date();
      existing.rejectionReason = "";
      return existing.save();
    }

    return HospitalDoctorModel.create({
      doctor: doctorId,
      hospital: hospitalId,
      department: String(department).trim(),
      status: "ACTIVE",
      requestedBy: "ADMIN",
      joinedAt: new Date(),
    });
  }

  async aggregate(pipeline: any[]): Promise<any[]> {
    return HospitalDoctorModel.aggregate(pipeline).exec();
  }

  async distinct(field: string, filter: Record<string, unknown>): Promise<any[]> {
    return HospitalDoctorModel.find(filter).distinct(field).exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return HospitalDoctorModel.countDocuments(filter).exec();
  }
}
