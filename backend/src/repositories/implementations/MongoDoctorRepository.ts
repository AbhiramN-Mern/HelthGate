import { Types } from "mongoose";
import DoctorModel, { Doctor } from "../../models/doctor.model.js";
import { IDoctorRepository } from "../interfaces/IDoctorRepository.js";

export class MongoDoctorRepository implements IDoctorRepository {
  async findByUserId(userId: string | Types.ObjectId, populateDetails = true): Promise<any | null> {
    const query = DoctorModel.findOne({ user: userId });
    if (populateDetails) {
      query.populate("user", "name email role").populate("hospital", "name isActive");
    }
    return query.exec();
  }

  async findById(id: string | Types.ObjectId, populateDetails = true): Promise<any | null> {
    const query = DoctorModel.findById(id);
    if (populateDetails) {
      query.populate("user", "name email role").populate("hospital", "name isActive");
    }
    return query.exec();
  }

  async findByLicenseNumber(licenseNumber: string): Promise<any | null> {
    return DoctorModel.findOne({ licenseNumber }).exec();
  }

  async create(doctorData: Partial<Doctor>): Promise<any> {
    return DoctorModel.create(doctorData);
  }

  async updateByUserId(userId: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null> {
    return DoctorModel.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate("user", "name email role")
      .populate("hospital", "name isActive")
      .exec();
  }

  async updateById(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null> {
    return DoctorModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate("user", "name email role")
      .populate("hospital", "name isActive")
      .exec();
  }

  async toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null> {
    const doctor = await DoctorModel.findById(id);
    if (!doctor) return null;
    doctor.active = !doctor.active;
    return doctor.save();
  }

  async deleteById(id: string | Types.ObjectId): Promise<any> {
    return DoctorModel.findByIdAndDelete(id).exec();
  }

  async find(
    filter: Record<string, unknown> = {},
    populateDetails = true,
    sort: Record<string, 1 | -1> = { createdAt: -1 },
  ): Promise<any[]> {
    const query = DoctorModel.find(filter).sort(sort);
    if (populateDetails) {
      query.populate("user", "name email role").populate("hospital", "name isActive");
    }
    return query.exec();
  }

  async distinctSpecializations(): Promise<string[]> {
    const raw = await DoctorModel.distinct("specialization", {
      specialization: { $exists: true, $ne: "" },
      active: { $ne: false },
      verificationStatus: "verified",
    });

    return raw
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim())
      .sort((a, b) => a.localeCompare(b));
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return DoctorModel.countDocuments(filter).exec();
  }
}
