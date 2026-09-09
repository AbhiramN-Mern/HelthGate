import type { Request, Response } from "express";

import AdminModel from "../models/admin.model.js";
import DoctorModel from "../models/doctor.model.js";
import PatientModel from "../models/patient.model.js";
import UserModel from "../models/user.model.js";
import AppointmentModel from "../models/appointment.model.js";
import HospitalModel from "../models/hospital.model.js";
import HospitalDoctorModel from "../models/hospitalDoctor.model.js";
import NotificationModel from "../models/notification.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const users = await UserModel.find().select("-password").sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      users,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch users",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllPatients = async (req: Request, res: Response) => {
  try {
    const patients = await PatientModel.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      patients,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patients",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getPatientById = async (req: Request, res: Response) => {
  try {
    const patient = await PatientModel.findById(req.params.id).populate(
      "user",
      "name email role",
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient details",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const togglePatientStatus = async (req: Request, res: Response) => {
  try {
    const patient = await PatientModel.findById(req.params.id);

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    patient.active = !patient.active;
    await patient.save();

    return res.status(200).json({
      success: true,
      message: patient.active ? "Patient activated" : "Patient deactivated",
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update patient status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const toggleDoctorStatus = async (req: Request, res: Response) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    doctor.active = !doctor.active;
    doctor.available = doctor.active;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: doctor.active ? "Doctor activated" : "Doctor deactivated",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update doctor status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const deleteDoctor = async (req: Request, res: Response) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const userId = doctor.user;
    await DoctorModel.findByIdAndDelete(req.params.id);
    await UserModel.findByIdAndDelete(userId);

    return res.status(200).json({
      success: true,
      message: "Doctor deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to delete doctor",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createDoctor = async (req: Request, res: Response) => {
  try {
    const {
      name,
      email,
      password,
      specialization,
      qualification,
      licenseNumber,
      consultationFee,
      experienceYears,
      available = true,
      profileImage,
      hospital,
    } = req.body as {
      name?: string
      email?: string
      password?: string
      specialization?: string
      qualification?: string
      licenseNumber?: string
      consultationFee?: number
      experienceYears?: number
      available?: boolean
      profileImage?: string
      hospital?: string
    }

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      })
    }

    if (!specialization || !qualification || !licenseNumber) {
      return res.status(400).json({
        success: false,
        message: "Specialization, qualification, and license number are required",
      })
    }

    const existingUser = await UserModel.findOne({ email })

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      })
    }

    const hashedPassword = await import("bcryptjs").then(({ default: bcrypt }) =>
      bcrypt.hash(password, 10),
    )

    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role: "doctor",
    })

    const doctor = await DoctorModel.create({
      user: user._id,
      specialization,
      qualification,
      licenseNumber,
      consultationFee: consultationFee ?? 0,
      experienceYears: experienceYears ?? 0,
      available,
      active: true,
      profileImage: profileImage || "",
      hospital: hospital || null,
      verificationStatus: "pending",
    })

    return res.status(201).json({
      success: true,
      message: "Doctor created successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      doctor,
    })
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create doctor",
      error: error instanceof Error ? error.message : "Unknown error",
    })
  }
}

export const getAllDoctors = async (req: Request, res: Response) => {
  try {
    const doctors = await DoctorModel.find()
      .populate("user", "name email role")
      .populate("hospital", "name isActive")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctors",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getDoctorById = async (req: Request, res: Response) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id)
      .populate("user", "name email role")
      .populate("hospital", "name isActive");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctor details",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const doctorAdminUpdateFields = [
  "specialization",
  "qualification",
  "profileImage",
  "experienceYears",
  "licenseNumber",
  "consultationFee",
  "active",
  "available",
  "hospital",
  "verificationStatus",
] as const;

export const updateDoctorById = async (req: Request, res: Response) => {
  try {
    const updates = Object.fromEntries(
      doctorAdminUpdateFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]]),
    );

    const doctor = await DoctorModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    ).populate("user", "name email role");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor updated successfully",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update doctor",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const verifyDoctor = async (req: Request, res: Response) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    doctor.verificationStatus = "verified";
    doctor.available = true;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Doctor verified successfully",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to verify doctor",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const rejectDoctor = async (req: Request, res: Response) => {
  try {
    const doctor = await DoctorModel.findById(req.params.id);

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    doctor.verificationStatus = "rejected";
    doctor.available = false;
    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Doctor rejected successfully",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject doctor",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

const patientAdminUpdateFields = [
  "dateOfBirth",
  "gender",
  "phone",
  "address",
  "bloodGroup",
  "allergies",
  "medicalHistory",
  "profileImage",
  "active",
] as const;

export const updatePatientById = async (req: Request, res: Response) => {
  try {
    const updates = Object.fromEntries(
      patientAdminUpdateFields
        .filter((field) => req.body[field] !== undefined)
        .map((field) => [field, req.body[field]]),
    );

    const patient = await PatientModel.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true },
    ).populate("user", "name email role");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient updated successfully",
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update patient",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await AdminModel.find()
      .populate("user", "name email role")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      admins,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admins",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    const totalPatients = await PatientModel.countDocuments();
    const totalDoctors = await DoctorModel.countDocuments();
    const totalHospitals = await HospitalModel.countDocuments();
    const totalAppointments = await AppointmentModel.countDocuments();
    const pendingDoctorApprovals = await DoctorModel.countDocuments({
      verificationStatus: "pending",
    });
    const pendingDoctorJoinRequests = await HospitalDoctorModel.countDocuments({
      status: "PENDING",
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayAppointments = await AppointmentModel.countDocuments({
      appointmentDate: { $gte: startOfToday, $lte: endOfToday },
    });

    // Recent Appointments (latest 6)
    const recentAppointments = await AppointmentModel.find()
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        populate: [{ path: "user", select: "name email" }, { path: "hospital", select: "name" }],
      })
      .populate("hospital", "name")
      .sort({ createdAt: -1 })
      .limit(6);

    // Pending Doctor Approvals (top 6)
    const pendingDoctors = await DoctorModel.find({ verificationStatus: "pending" })
      .populate("user", "name email")
      .populate("hospital", "name")
      .sort({ createdAt: -1 })
      .limit(6);

    // Daily breakdown: last 7 days
    const dailyAppointments = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
      const count = await AppointmentModel.countDocuments({
        appointmentDate: { $gte: start, $lte: end },
      });
      dailyAppointments.push({
        label: d.toLocaleDateString("en-US", { weekday: "short" }),
        date: d.toISOString().split("T")[0],
        count,
      });
    }

    // Weekly breakdown: last 4 weeks
    const weeklyAppointments = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date(now);
      start.setDate(start.getDate() - (w * 7 + 6));
      const end = new Date(now);
      end.setDate(end.getDate() - w * 7);
      const count = await AppointmentModel.countDocuments({
        appointmentDate: { $gte: start, $lte: end },
      });
      weeklyAppointments.push({
        label: `W${4 - w}`,
        count,
      });
    }

    // Monthly breakdown: last 6 months
    const monthlyAppointments = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const count = await AppointmentModel.countDocuments({
        appointmentDate: { $gte: start, $lte: end },
      });
      monthlyAppointments.push({
        label: d.toLocaleDateString("en-US", { month: "short" }),
        count,
      });
    }

    // User growth (patients + doctors over last 6 months)
    const userGrowth = [];
    for (let m = 5; m >= 0; m--) {
      const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
      const patientsCount = await PatientModel.countDocuments({ createdAt: { $lte: end } });
      const doctorsCount = await DoctorModel.countDocuments({ createdAt: { $lte: end } });
      userGrowth.push({
        month: d.toLocaleDateString("en-US", { month: "short" }),
        patients: patientsCount,
        doctors: doctorsCount,
      });
    }

    return res.status(200).json({
      success: true,
      stats: {
        totalPatients,
        totalDoctors,
        totalHospitals,
        totalAppointments,
        pendingDoctorApprovals,
        pendingDoctorJoinRequests,
        todayAppointments,
      },
      appointmentsOverview: {
        daily: dailyAppointments,
        weekly: weeklyAppointments,
        monthly: monthlyAppointments,
      },
      userGrowth,
      recentAppointments,
      pendingDoctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch admin dashboard data",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAllAppointmentsForAdmin = async (req: Request, res: Response) => {
  try {
    const appointments = await AppointmentModel.find()
      .populate("patient", "name email")
      .populate({
        path: "doctor",
        populate: [{ path: "user", select: "name email" }, { path: "hospital", select: "name" }],
      })
      .populate("hospital", "name")
      .sort({ appointmentDate: -1 });

    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// ==========================================
// MAIN ADMIN: DOCTOR-HOSPITAL GOVERNANCE
// ==========================================

export const getAllHospitalDoctorsForAdmin = async (req: Request, res: Response) => {
  try {
    const { status, hospitalId, doctorId } = req.query;
    const filter: Record<string, unknown> = {};

    if (status && typeof status === "string" && status.trim()) {
      filter.status = status.trim().toUpperCase();
    }
    if (hospitalId && typeof hospitalId === "string" && hospitalId.trim()) {
      filter.hospital = hospitalId.trim();
    }
    if (doctorId && typeof doctorId === "string" && doctorId.trim()) {
      filter.doctor = doctorId.trim();
    }

    const relationships = await HospitalDoctorModel.find(filter)
      .populate("hospital")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email role" },
      })
      .populate("approvedBy", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      relationships,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch Doctor-Hospital relationships",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const approveDoctorHospitalRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const adminUserId = req.user?.id;

    const relationship = await HospitalDoctorModel.findById(id);
    if (!relationship) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    relationship.status = "ACTIVE";
    relationship.approvedBy = adminUserId as any;
    relationship.joinedAt = new Date();
    await relationship.save();

    const populated = await HospitalDoctorModel.findById(relationship._id)
      .populate("hospital")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    // Notify doctor
    try {
      const doc = populated?.doctor as any;
      const hosp = populated?.hospital as any;
      if (doc?.user?._id) {
        await NotificationModel.create({
          recipient: doc.user._id,
          type: "system",
          title: "Hospital Join Request Approved",
          message: `Your request to join ${hosp?.name || "the hospital"} has been approved by the Main Admin. You are now actively affiliated.`,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create notification:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Doctor-Hospital relationship approved and activated",
      relationship: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to approve relationship",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const rejectDoctorHospitalRequest = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason = "" } = req.body;
    const adminUserId = req.user?.id;

    const relationship = await HospitalDoctorModel.findById(id);
    if (!relationship) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    relationship.status = "REJECTED";
    relationship.rejectionReason = String(reason).trim();
    relationship.approvedBy = adminUserId as any;
    await relationship.save();

    const populated = await HospitalDoctorModel.findById(relationship._id)
      .populate("hospital")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    // Notify doctor
    try {
      const doc = populated?.doctor as any;
      const hosp = populated?.hospital as any;
      if (doc?.user?._id) {
        await NotificationModel.create({
          recipient: doc.user._id,
          type: "system",
          title: "Hospital Join Request Declined",
          message: `Your request to join ${hosp?.name || "the hospital"} was reviewed by the Main Admin and declined.${reason ? ` Reason: ${reason}` : ""}`,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create notification:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Doctor-Hospital request rejected",
      relationship: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to reject relationship",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const associateDoctorWithHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, hospitalId, department = "" } = req.body;
    const adminUserId = req.user?.id;

    if (!doctorId || !hospitalId) {
      return res.status(400).json({
        success: false,
        message: "doctorId and hospitalId are required",
      });
    }

    const doctor = await DoctorModel.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const hospital = await HospitalModel.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ success: false, message: "Hospital not found" });
    }

    // Check if an existing relationship exists
    let relationship = await HospitalDoctorModel.findOne({
      doctor: doctorId,
      hospital: hospitalId,
    });

    if (relationship) {
      relationship.status = "ACTIVE";
      relationship.requestedBy = "ADMIN";
      relationship.approvedBy = adminUserId as any;
      relationship.joinedAt = relationship.joinedAt || new Date();
      if (department) relationship.department = String(department).trim();
      await relationship.save();
    } else {
      relationship = await HospitalDoctorModel.create({
        doctor: doctorId,
        hospital: hospitalId,
        department: String(department).trim(),
        status: "ACTIVE",
        requestedBy: "ADMIN",
        approvedBy: adminUserId as any,
        joinedAt: new Date(),
      });
    }

    const populated = await HospitalDoctorModel.findById(relationship._id)
      .populate("hospital")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    return res.status(200).json({
      success: true,
      message: "Doctor successfully associated with hospital",
      relationship: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to associate doctor with hospital",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const removeDoctorFromHospital = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const relationship = await HospitalDoctorModel.findById(id);
    if (!relationship) {
      return res.status(404).json({ success: false, message: "Relationship not found" });
    }

    relationship.status = "REMOVED";
    await relationship.save();

    const populated = await HospitalDoctorModel.findById(relationship._id)
      .populate("hospital")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      });

    return res.status(200).json({
      success: true,
      message: "Doctor association removed from hospital",
      relationship: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to remove association",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getHospitalDoctorHistory = async (req: Request, res: Response) => {
  try {
    const history = await HospitalDoctorModel.find()
      .populate("hospital", "name licenseNumber")
      .populate({
        path: "doctor",
        populate: { path: "user", select: "name email" },
      })
      .populate("approvedBy", "name email")
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch relationship history",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

