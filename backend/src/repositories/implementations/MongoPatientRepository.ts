import { Types } from "mongoose";
import PatientModel, { Patient } from "../../models/patient.model.js";
import { IPatientRepository } from "../interfaces/IPatientRepository.js";

export class MongoPatientRepository implements IPatientRepository {
  async findByUserId(userId: string | Types.ObjectId, populateUser = false): Promise<any | null> {
    const query = PatientModel.findOne({ user: userId });
    if (populateUser) {
      query.populate("user", "name email role");
    }
    return query.exec();
  }

  async findById(id: string | Types.ObjectId, populateUser = false): Promise<any | null> {
    const query = PatientModel.findById(id);
    if (populateUser) {
      query.populate("user", "name email role");
    }
    return query.exec();
  }

  async create(patientData: Partial<Patient>): Promise<any> {
    return PatientModel.create(patientData);
  }

  async updateByUserId(userId: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null> {
    return PatientModel.findOneAndUpdate(
      { user: userId },
      { $set: { user: userId, ...updates } },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    ).populate("user", "name email role").exec();
  }

  async updateById(id: string | Types.ObjectId, updates: Record<string, unknown>): Promise<any | null> {
    return PatientModel.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
      .populate("user", "name email role")
      .exec();
  }

  async toggleActiveStatus(id: string | Types.ObjectId): Promise<any | null> {
    const patient = await PatientModel.findById(id);
    if (!patient) return null;
    patient.active = !patient.active;
    return patient.save();
  }

  async findAll(populateUser = true): Promise<any[]> {
    const query = PatientModel.find().sort({ createdAt: -1 });
    if (populateUser) {
      query.populate("user", "name email role");
    }
    return query.exec();
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PatientModel.countDocuments(filter).exec();
  }
}
