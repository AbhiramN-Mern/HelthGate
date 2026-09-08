import type { Response } from "express";

import DoctorModel from "../models/doctor.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

const doctorUpdateFields = [
  "specialization",
  "qualification",
  "profileImage",
  "experienceYears",
  "licenseNumber",
  "consultationFee",
  "available",
  "hospital",
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
    const doctor = await DoctorModel.findOne({ user: req.user?.id })
      .populate("user", "name email role")
      .populate("hospital", "name isActive");

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
      { $set: { user: req.user?.id, ...updates } },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
      },
    )
      .populate("user", "name email role")
      .populate("hospital", "name isActive");

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
    const { search, specialization, hospital } = req.query;

    const query: Record<string, unknown> = {
      available: true,
      active: { $ne: false },
      verificationStatus: { $in: ["verified", "pending"] },
    };

    if (specialization && typeof specialization === "string" && specialization.trim()) {
      query.specialization = { $regex: new RegExp(`^${specialization.trim()}$`, "i") };
    }

    if (hospital && typeof hospital === "string" && hospital.trim()) {
      query.hospital = hospital.trim();
    }

    let doctors = await DoctorModel.find(query)
      .populate("user", "name email role")
      .populate("hospital", "name isActive")
      .sort({ createdAt: -1 });

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim().toLowerCase();
      doctors = doctors.filter((doc: any) => {
        const docName = doc.user?.name?.toLowerCase() || "";
        const spec = doc.specialization?.toLowerCase() || "";
        const hospName = doc.hospital?.name?.toLowerCase() || "";
        return docName.includes(term) || spec.includes(term) || hospName.includes(term);
      });
    }

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
