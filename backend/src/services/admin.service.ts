import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPatientRepository } from "../repositories/interfaces/IPatientRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { IHospitalRepository } from "../repositories/interfaces/IHospitalRepository.js";
import { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IAdminRepository } from "../repositories/interfaces/IAdminRepository.js";
import { IPasswordHasher } from "../core/security/IPasswordHasher.js";
import { BadRequestError, ConflictError, NotFoundError } from "../core/errors/AppError.js";

export class AdminService {
  constructor(
    private userRepo: IUserRepository,
    private patientRepo: IPatientRepository,
    private doctorRepo: IDoctorRepository,
    private hospitalRepo: IHospitalRepository,
    private hospitalDoctorRepo: IHospitalDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private notificationRepo: INotificationRepository,
    private adminRepo: IAdminRepository,
    private passwordHasher: IPasswordHasher,
  ) {}

  async getAllUsers() {
    return this.userRepo.findAll();
  }

  async getAllPatients() {
    return this.patientRepo.findAll(true);
  }

  async getPatientById(id: string) {
    const patient = await this.patientRepo.findById(id, true);
    if (!patient) {
      throw new NotFoundError("Patient not found");
    }
    return patient;
  }

  async togglePatientStatus(id: string) {
    const patient = await this.patientRepo.toggleActiveStatus(id);
    if (!patient) {
      throw new NotFoundError("Patient not found");
    }
    return patient;
  }

  async updatePatientById(id: string, updates: Record<string, unknown>) {
    const patient = await this.patientRepo.updateById(id, updates);
    if (!patient) {
      throw new NotFoundError("Patient not found");
    }
    return patient;
  }

  async getAllDoctors() {
    const doctors = await this.doctorRepo.find({}, true, { createdAt: -1 });

    const doctorIds = doctors.map((d: any) => d._id);
    const activeAssociations = await this.hospitalDoctorRepo.find(
      { doctor: { $in: doctorIds }, status: "ACTIVE" },
      { path: "hospital", select: "name isActive departments" },
    );

    const doctorHospitalsMap: Record<string, any[]> = {};
    activeAssociations.forEach((assoc: any) => {
      const docId = String(assoc.doctor);
      if (!doctorHospitalsMap[docId]) doctorHospitalsMap[docId] = [];
      if (assoc.hospital) {
        doctorHospitalsMap[docId].push({
          _id: assoc.hospital._id,
          name: assoc.hospital.name,
          department: assoc.department,
          relationshipId: assoc._id,
        });
      }
    });

    return doctors.map((d: any) => {
      const activeHospitals = doctorHospitalsMap[String(d._id)] || [];
      if (d.hospital && !activeHospitals.some((h) => String(h._id) === String(d.hospital._id))) {
        activeHospitals.push({
          _id: d.hospital._id,
          name: d.hospital.name,
          department: "",
        });
      }

      const docObj = d.toObject ? d.toObject() : { ...d };
      return {
        ...docObj,
        affiliatedHospitals: activeHospitals,
        isFreelance: activeHospitals.length === 0,
      };
    });
  }

  async getDoctorById(id: string) {
    const doctor = await this.doctorRepo.findById(id, true);
    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }

    const activeAssociations = await this.hospitalDoctorRepo.find(
      { doctor: doctor._id, status: "ACTIVE" },
      "hospital",
    );

    const docObj = doctor.toObject ? doctor.toObject() : doctor;
    return {
      ...docObj,
      affiliatedHospitals: activeAssociations.map((assoc: any) => ({
        _id: assoc.hospital?._id,
        name: assoc.hospital?.name,
        department: assoc.department,
        relationshipId: assoc._id,
      })),
    };
  }

  async createDoctor(data: {
    name?: string;
    email?: string;
    password?: string;
    specialization?: string;
    qualification?: string;
    licenseNumber?: string;
    experienceYears?: number;
    consultationFee?: number;
    hospital?: string;
  }) {
    const {
      name,
      email,
      password,
      specialization,
      qualification,
      licenseNumber,
      experienceYears = 0,
      consultationFee = 0,
    } = data;

    if (!name || !email || !password || !specialization || !qualification || !licenseNumber) {
      throw new BadRequestError(
        "Name, email, password, specialization, qualification, and licenseNumber are required",
      );
    }

    const existingUser = await this.userRepo.findByEmail(email);
    if (existingUser) {
      throw new ConflictError("Email is already registered");
    }

    const existingLicense = await this.doctorRepo.findByLicenseNumber(licenseNumber);
    if (existingLicense) {
      throw new ConflictError("License number is already registered");
    }

    const hashedPassword = await this.passwordHasher.hash(password);
    const user = await this.userRepo.create({
      name,
      email,
      password: hashedPassword,
      role: "doctor",
    });

    try {
      const doctor = await this.doctorRepo.create({
        user: user.id as any,
        specialization,
        qualification,
        licenseNumber,
        experienceYears,
        consultationFee,
        verificationStatus: "verified",
      });

      return { user, doctor };
    } catch (error) {
      await this.userRepo.findByIdAndDelete(user.id);
      throw error;
    }
  }

  async updateDoctorById(id: string, updates: Record<string, unknown>) {
    const doctor = await this.doctorRepo.updateById(id, updates);
    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }
    return doctor;
  }

  async toggleDoctorStatus(id: string) {
    const doctor = await this.doctorRepo.toggleActiveStatus(id);
    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }
    return doctor;
  }

  async verifyDoctor(id: string) {
    const doctor = await this.doctorRepo.updateById(id, {
      verificationStatus: "verified",
      active: true,
    });

    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }

    try {
      if (doctor.user) {
        const recipientId = (doctor.user as any)?._id || doctor.user;
        await this.notificationRepo.create({
          recipient: recipientId,
          type: "verification",
          title: "Account Verified",
          message: "Congratulations! Your doctor profile has been verified by the administrator. You can now accept appointments.",
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create verification notification:", notifErr);
    }

    return doctor;
  }

  async rejectDoctor(id: string, reason?: string) {
    const doctor = await this.doctorRepo.updateById(id, {
      verificationStatus: "rejected",
    });

    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }

    try {
      if (doctor.user) {
        const recipientId = (doctor.user as any)?._id || doctor.user;
        await this.notificationRepo.create({
          recipient: recipientId,
          type: "system",
          title: "Verification Request Rejected",
          message: `Your doctor verification request was rejected by the administrator.${reason ? ` Reason: ${reason}` : ""}`,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create rejection notification:", notifErr);
    }

    return doctor;
  }

  async deleteDoctor(id: string) {
    const doctor = await this.doctorRepo.findById(id, false);
    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }

    if (doctor.user) {
      await this.userRepo.findByIdAndDelete(doctor.user);
    }
    await this.doctorRepo.deleteById(id);
    return true;
  }

  async getAllAdmins() {
    return this.adminRepo.findAll();
  }

  async getAdminDashboard() {
    const [
      totalUsers,
      totalDoctors,
      verifiedDoctors,
      pendingDoctors,
      rejectedDoctors,
      totalPatients,
      totalHospitals,
      activeHospitals,
      totalAppointments,
      completedAppointments,
      cancelledAppointments,
      scheduledAppointments,
      pendingHospitalDoctorRequests,
      recentAppointments,
    ] = await Promise.all([
      this.userRepo.findAll().then((users) => users.length),
      this.doctorRepo.count(),
      this.doctorRepo.count({ verificationStatus: "verified" }),
      this.doctorRepo.count({ verificationStatus: "pending" }),
      this.doctorRepo.count({ verificationStatus: "rejected" }),
      this.patientRepo.count(),
      this.hospitalRepo.count(),
      this.hospitalRepo.count({ isActive: true }),
      this.appointmentRepo.count(),
      this.appointmentRepo.count({ status: "completed" }),
      this.appointmentRepo.count({ status: "cancelled" }),
      this.appointmentRepo.count({ status: { $in: ["scheduled", "confirmed"] } }),
      this.hospitalDoctorRepo.count({ status: "PENDING" }),
      this.appointmentRepo.find({}, true, { createdAt: -1 }),
    ]);

    return {
      metrics: {
        totalUsers,
        totalDoctors,
        verifiedDoctors,
        pendingDoctors,
        rejectedDoctors,
        totalPatients,
        totalHospitals,
        activeHospitals,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        scheduledAppointments,
        pendingHospitalDoctorRequests,
      },
      recentAppointments: recentAppointments.slice(0, 10),
    };
  }

  async getAllAppointmentsForAdmin(query: Record<string, unknown> = {}) {
    return this.appointmentRepo.find(query, true, { createdAt: -1 });
  }

  async getAllHospitalDoctorsForAdmin() {
    return this.hospitalDoctorRepo.find(
      {},
      [
        { path: "doctor", populate: { path: "user", select: "name email" } },
        { path: "hospital", select: "name isActive departments" },
      ],
      { updatedAt: -1 },
    );
  }

  async getHospitalDoctorHistory() {
    return this.hospitalDoctorRepo.find(
      { status: { $in: ["REJECTED", "REMOVED", "ACTIVE"] } },
      [
        { path: "doctor", populate: { path: "user", select: "name email" } },
        { path: "hospital", select: "name" },
      ],
      { updatedAt: -1 },
    );
  }

  async associateDoctorWithHospital(data: {
    doctorId: string;
    hospitalId: string;
    department?: string;
  }) {
    const { doctorId, hospitalId, department = "" } = data;

    if (!doctorId || !hospitalId) {
      throw new BadRequestError("Doctor ID and Hospital ID are required");
    }

    const doctor = await this.doctorRepo.findById(doctorId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor not found");
    }

    const hospital = await this.hospitalRepo.findById(hospitalId);
    if (!hospital) {
      throw new NotFoundError("Hospital not found");
    }

    const association = await this.hospitalDoctorRepo.upsertActiveAssociation(
      doctorId,
      hospitalId,
      department,
    );

    return this.hospitalDoctorRepo.findById(association._id, [
      { path: "doctor", populate: { path: "user", select: "name email" } },
      { path: "hospital" },
    ]);
  }

  async approveDoctorHospitalRequest(id: string) {
    const updated = await this.hospitalDoctorRepo.updateAssociationStatus(id, "ACTIVE", {
      joinedAt: new Date(),
    });

    if (!updated) {
      throw new NotFoundError("Request not found");
    }

    return this.hospitalDoctorRepo.findById(id, [
      { path: "doctor", populate: { path: "user", select: "name email" } },
      { path: "hospital" },
    ]);
  }

  async rejectDoctorHospitalRequest(id: string, reason?: string) {
    const updated = await this.hospitalDoctorRepo.updateAssociationStatus(id, "REJECTED", {
      rejectionReason: reason || "Request rejected by administrator",
    });

    if (!updated) {
      throw new NotFoundError("Request not found");
    }

    return this.hospitalDoctorRepo.findById(id, [
      { path: "doctor", populate: { path: "user", select: "name email" } },
      { path: "hospital" },
    ]);
  }

  async removeDoctorFromHospital(id: string, reason?: string) {
    const updated = await this.hospitalDoctorRepo.updateAssociationStatus(id, "REMOVED", {
      leftAt: new Date(),
      rejectionReason: reason || "Removed by administrator",
    });

    if (!updated) {
      throw new NotFoundError("Relationship not found");
    }

    return this.hospitalDoctorRepo.findById(id, [
      { path: "doctor", populate: { path: "user", select: "name email" } },
      { path: "hospital" },
    ]);
  }
}
