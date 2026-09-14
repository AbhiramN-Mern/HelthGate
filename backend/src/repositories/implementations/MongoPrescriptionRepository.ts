import type { Types } from "mongoose";
import PrescriptionModel, { type Prescription } from "../../models/prescription.model.js";
import type {
  CreatePrescriptionDto,
  IPrescriptionRepository,
} from "../interfaces/IPrescriptionRepository.js";

export class MongoPrescriptionRepository implements IPrescriptionRepository {
  async create(data: CreatePrescriptionDto): Promise<Prescription> {
    const record = await PrescriptionModel.create(data);
    return record.toObject() as Prescription;
  }

  async findById(id: string | Types.ObjectId): Promise<Prescription | null> {
    const record = await PrescriptionModel.findById(id)
      .populate("patient", "name email phone gender dateOfBirth")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .populate("appointment", "appointmentDate timeSlot status consultationType")
      .exec();
    return record ? (record.toObject() as Prescription) : null;
  }

  async findByAppointmentId(
    appointmentId: string | Types.ObjectId,
    populate = true,
  ): Promise<Prescription | null> {
    let query = PrescriptionModel.findOne({ appointment: appointmentId });
    if (populate) {
      query = query
        .populate("patient", "name email phone gender dateOfBirth")
        .populate({
          path: "doctor",
          populate: { path: "user", select: "name email" },
        })
        .populate("appointment", "appointmentDate timeSlot status consultationType");
    }
    const record = await query.exec();
    return record ? (record.toObject() as Prescription) : null;
  }

  async findByPatientId(
    patientId: string | Types.ObjectId,
    limit = 50,
    skip = 0,
  ): Promise<Prescription[]> {
    const records = await PrescriptionModel.find({ patient: patientId })
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .populate("appointment", "appointmentDate timeSlot status consultationType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    return records.map((r) => r.toObject() as Prescription);
  }

  async findByDoctorId(
    doctorId: string | Types.ObjectId,
    limit = 50,
    skip = 0,
  ): Promise<Prescription[]> {
    const records = await PrescriptionModel.find({ doctor: doctorId })
      .populate("patient", "name email phone gender dateOfBirth")
      .populate("appointment", "appointmentDate timeSlot status consultationType")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .exec();
    return records.map((r) => r.toObject() as Prescription);
  }

  async updateByAppointmentId(
    appointmentId: string | Types.ObjectId,
    data: Partial<CreatePrescriptionDto>,
  ): Promise<Prescription | null> {
    const record = await PrescriptionModel.findOneAndUpdate(
      { appointment: appointmentId },
      { $set: data },
      { new: true },
    )
      .populate("patient", "name email phone gender dateOfBirth")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .populate("appointment", "appointmentDate timeSlot status consultationType")
      .exec();
    return record ? (record.toObject() as Prescription) : null;
  }

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return PrescriptionModel.countDocuments(filter).exec();
  }
}
