import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { prescriptionService } from "../container.js";

/**
 * POST /api/prescriptions/appointment/:appointmentId
 * Also aliased as POST /api/appointments/:appointmentId/prescription
 * Doctor creates or updates a prescription for an appointment.
 */
export const savePrescription = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const doctorUserId = req.user?.id;
    if (!doctorUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const appointmentId = String(req.params.appointmentId || req.body?.appointmentId || "");
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const { diagnosis, medicines, additionalAdvice, followUpDate } = req.body || {};

    const prescription = await prescriptionService.createOrUpdatePrescription({
      appointmentId,
      doctorUserId,
      diagnosis,
      medicines,
      additionalAdvice,
      followUpDate,
    });

    return res.status(200).json({
      success: true,
      message: "Prescription saved successfully",
      prescription,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to save prescription",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * GET /api/prescriptions/appointment/:appointmentId
 * Also aliased as GET /api/appointments/:appointmentId/prescription
 * Authorized patient, doctor, or admin retrieves prescription for an appointment.
 */
export const getPrescriptionByAppointment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role || "patient";
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const appointmentId = String(req.params.appointmentId || "");
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required",
      });
    }

    const prescription = await prescriptionService.getPrescriptionByAppointment({
      appointmentId,
      userId,
      userRole,
    });

    return res.status(200).json({
      success: true,
      prescription,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve prescription",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * GET /api/prescriptions/my
 * Logged-in user (patient or doctor) retrieves their prescription history.
 */
export const getMyPrescriptions = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role || "patient";
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const prescriptions = await prescriptionService.getMyPrescriptions({
      userId,
      userRole,
    });

    return res.status(200).json({
      success: true,
      prescriptions,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to retrieve prescriptions",
      error: error.message || "Unknown error",
    });
  }
};
