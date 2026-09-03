import type { Request, Response } from "express";

import AdminModel from "../models/admin.model.js";
import DoctorModel from "../models/doctor.model.js";
import PatientModel from "../models/patient.model.js";
import UserModel from "../models/user.model.js";

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
    const doctor = await DoctorModel.findById(req.params.id).populate(
      "user",
      "name email role",
    );

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
