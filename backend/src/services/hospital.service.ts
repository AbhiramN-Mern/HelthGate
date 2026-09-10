import { IHospitalRepository } from "../repositories/interfaces/IHospitalRepository.js";
import { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import { BadRequestError, NotFoundError } from "../core/errors/AppError.js";

export class HospitalService {
  constructor(
    private hospitalRepo: IHospitalRepository,
    private hospitalDoctorRepo: IHospitalDoctorRepository,
  ) {}

  private async enrichHospitalsWithActiveDoctorCount(hospitals: any[]) {
    const hospitalIds = hospitals.map((h) => h._id);
    const activeDocCounts = await this.hospitalDoctorRepo.aggregate([
      { $match: { hospital: { $in: hospitalIds }, status: "ACTIVE" } },
      { $group: { _id: "$hospital", count: { $sum: 1 } } },
    ]);

    const countMap: Record<string, number> = {};
    activeDocCounts.forEach((c) => {
      countMap[String(c._id)] = c.count;
    });

    return hospitals.map((h) => ({
      ...h,
      activeDoctorsCount: countMap[String(h._id)] || 0,
    }));
  }

  async getActiveHospitals() {
    const hospitals = await this.hospitalRepo.find({ isActive: true }, { name: 1 });
    return this.enrichHospitalsWithActiveDoctorCount(hospitals);
  }

  async getAllHospitals() {
    const hospitals = await this.hospitalRepo.find({}, { name: 1 });
    return this.enrichHospitalsWithActiveDoctorCount(hospitals);
  }

  async getHospitalById(id: string) {
    const hospital = await this.hospitalRepo.findById(id);
    if (!hospital) {
      throw new NotFoundError("Hospital not found");
    }

    const activeDoctors = await this.hospitalDoctorRepo.find(
      { hospital: id, status: "ACTIVE" },
      {
        path: "doctor",
        populate: { path: "user", select: "name email role" },
      },
    );

    const hospitalObj = hospital.toObject ? hospital.toObject() : hospital;
    return {
      ...hospitalObj,
      activeDoctorsCount: activeDoctors.length,
      doctors: activeDoctors,
    };
  }

  async createHospital(data: {
    name?: string;
    licenseNumber?: string;
    address?: Record<string, any>;
    contactInfo?: Record<string, any>;
    departments?: string[];
    isActive?: boolean;
    verificationStatus?: string;
  }) {
    const {
      name,
      licenseNumber = "",
      address = {},
      contactInfo = {},
      departments = ["General Medicine"],
      isActive = true,
      verificationStatus = "verified",
    } = data;

    if (!name || !String(name).trim()) {
      throw new BadRequestError("Hospital name is required");
    }

    return this.hospitalRepo.create({
      name: String(name).trim(),
      licenseNumber: String(licenseNumber || "").trim(),
      address: {
        street: address.street || "",
        city: address.city || "",
        state: address.state || "",
        zipCode: address.zipCode || "",
        country: address.country || "",
      },
      contactInfo: {
        phone: contactInfo.phone || "",
        email: contactInfo.email || "",
        website: contactInfo.website || "",
      },
      departments: Array.isArray(departments) && departments.length > 0
        ? departments.map((d: string) => String(d).trim()).filter(Boolean)
        : ["General Medicine"],
      isActive: Boolean(isActive),
      verificationStatus: (verificationStatus as any) || "verified",
    });
  }

  async updateHospitalById(id: string, data: Record<string, any>) {
    const {
      name,
      licenseNumber,
      address,
      contactInfo,
      departments,
      isActive,
      verificationStatus,
    } = data;

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (licenseNumber !== undefined) update.licenseNumber = String(licenseNumber).trim();
    if (address !== undefined) update.address = address;
    if (contactInfo !== undefined) update.contactInfo = contactInfo;
    if (departments !== undefined && Array.isArray(departments)) {
      update.departments = departments.map((d: string) => String(d).trim()).filter(Boolean);
    }
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (verificationStatus !== undefined) update.verificationStatus = verificationStatus;

    const hospital = await this.hospitalRepo.findByIdAndUpdate(id, update);
    if (!hospital) {
      throw new NotFoundError("Hospital not found");
    }

    return hospital;
  }

  async toggleHospitalStatus(id: string) {
    const hospital = await this.hospitalRepo.toggleActiveStatus(id);
    if (!hospital) {
      throw new NotFoundError("Hospital not found");
    }
    return hospital;
  }

  async verifyHospital(id: string, status = "verified") {
    const hospital = await this.hospitalRepo.findByIdAndUpdate(id, { verificationStatus: status });
    if (!hospital) {
      throw new NotFoundError("Hospital not found");
    }
    return hospital;
  }
}
