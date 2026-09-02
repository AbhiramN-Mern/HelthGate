import type { Response } from "express";

import DoctorModel from "../models/doctor.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

const doctorUpdateFields = [
  "specialization",
  "qualification",
  "experienceYears",
  "licenseNumber",
  "consultationFee",
  "available",
] as const;

const pickDoctorUpdates = (body: Record<string, unknown>) => {
  return Object.fromEntries(
    doctorUpdateFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
};

export const getMyDoctorProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const doctor = await DoctorModel.findOne({ user: req.user?.id }).populate(
      "user",
      "name email role",
    );

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctor profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateMyDoctorProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const updates = pickDoctorUpdates(req.body as Record<string, unknown>);
    const doctor = await DoctorModel.findOneAndUpdate(
      { user: req.user?.id },
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).populate("user", "name email role");

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update doctor profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getAvailableDoctors = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const doctors = await DoctorModel.find({ available: true }).populate(
      "user",
      "name email role",
    );

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
