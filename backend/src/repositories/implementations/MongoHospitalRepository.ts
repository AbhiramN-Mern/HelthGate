import { Types } from "mongoose";
import HospitalModel, { IHospital } from "../../models/hospital.model.js";
import { IHospitalRepository } from "../interfaces/IHospitalRepository.js";

export class MongoHospitalRepository implements IHospitalRepository {
  async find(filter: Record<string, unknown> = {}, sort: Record<string, 1 | -1> = { name: 1 }): Promise<any[]> {
    return HospitalModel.find(filter).sort(sort).lean().exec();
  }

  async findById(id: string | Types.ObjectId): Promise<any | null> {
    return HospitalModel.findById(id).exec();
  }

  async create(hospitalData: Partial<IHospital>): Promise<any> {
    return HospitalModel.create(hospitalData);
  }

  async findByIdAndUpdate(id: string | Types.ObjectId, update: Record<string, unknown>): Promise<any | null> {
    return HospitalModel.findByIdAndUpdate(id, update, { new: true }).exec();
  }

  async toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null> {
    const hospital = await HospitalModel.findById(id);
    if (!hospital) return null;
    hospital.isActive = !hospital.isActive;
    return hospital.save();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return HospitalModel.countDocuments(filter).exec();
  }
}
