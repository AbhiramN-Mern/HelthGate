import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { patientService } from "../container.js";

export const getMyPatientProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const patient = await patientService.getMyPatientProfile(userId);
    return res.status(200).json({
      success: true,
      patient,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch patient profile",
      error: error.message || "Unknown error",
    });
  }
};

export const updateMyPatientProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const patient = await patientService.updateMyPatientProfile(userId, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Patient profile updated successfully",
      patient,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update patient profile",
      error: error.message || "Unknown error",
    });
  }
};

export const getPatientNotifications = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const notifications = await patientService.getPatientNotifications(userId);
    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch notifications",
      error: error.message || "Unknown error",
    });
  }
};

export const markPatientNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const notificationId = String(req.params.notificationId);
    await patientService.markPatientNotificationRead(notificationId, userId);

    return res.status(200).json({
      success: true,
      message: "Notification marked as read",
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to mark notification as read",
      error: error.message || "Unknown error",
    });
  }
};
