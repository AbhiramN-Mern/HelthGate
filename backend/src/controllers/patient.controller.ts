import type { Response } from "express";

import PatientModel from "../models/patient.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

const patientUpdateFields = [
  "dateOfBirth",
  "gender",
  "phone",
  "address",
  "bloodGroup",
  "allergies",
  "medicalHistory",
] as const;

const pickPatientUpdates = (body: Record<string, unknown>) => {
  return Object.fromEntries(
    patientUpdateFields
      .filter((field) => body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
};

export const getMyPatientProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patient = await PatientModel.findOne({ user: req.user?.id }).populate(
      "user",
      "name email role",
    );

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateMyPatientProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const updates = pickPatientUpdates(req.body as Record<string, unknown>);
    const patient = await PatientModel.findOneAndUpdate(
      { user: req.user?.id },
      updates,
      {
        new: true,
        runValidators: true,
      },
    ).populate("user", "name email role");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient profile not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Patient profile updated successfully",
      patient,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update patient profile",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
