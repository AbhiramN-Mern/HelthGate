import type { Response } from "express";

import PatientModel from "../models/patient.model.js";
import NotificationModel from "../models/notification.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

const patientUpdateFields = [
  "dateOfBirth",
  "gender",
  "phone",
  "address",
  "profileImage",
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

    if (updates.dateOfBirth) {
      const dob = new Date(updates.dateOfBirth as string);
      if (isNaN(dob.getTime()) || dob > new Date()) {
        return res.status(400).json({
          success: false,
          message: "Date of birth cannot be in the future",
        });
      }
    }
    const patient = await PatientModel.findOneAndUpdate(
      { user: req.user?.id },
      { $set: { user: req.user?.id, ...updates } },
      {
        new: true,
        runValidators: true,
        upsert: true,
        setDefaultsOnInsert: true,
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

export const getPatientNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const notifications = await NotificationModel.find({ recipient: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markPatientNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { notificationId } = req.params;
    await NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipient: req.user?.id },
      { isRead: true },
    );

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
