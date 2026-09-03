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
