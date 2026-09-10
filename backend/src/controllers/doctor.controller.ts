import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { doctorService } from "../container.js";

export const getMyDoctorProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const doctor = await doctorService.getMyDoctorProfile(userId);
    return res.status(200).json({
      success: true,
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctor profile",
      error: error.message || "Unknown error",
    });
  }
};

export const updateMyDoctorProfile = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const doctor = await doctorService.updateMyDoctorProfile(userId, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Doctor profile updated successfully",
      doctor,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update doctor profile",
      error: error.message || "Unknown error",
    });
  }
};

export const getAvailableDoctors = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { search, specialization, hospital } = req.query;
    const doctors = await doctorService.getAvailableDoctors({
      search: typeof search === "string" ? search : undefined,
      specialization: typeof specialization === "string" ? specialization : undefined,
      hospital: typeof hospital === "string" ? hospital : undefined,
    });

    return res.status(200).json({
      success: true,
      doctors,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctors",
      error: error.message || "Unknown error",
    });
  }
};

export const getDoctorDashboard = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const dashboard = await doctorService.getDoctorDashboard(userId);
    return res.status(200).json({
      success: true,
      ...dashboard,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctor dashboard",
      error: error.message || "Unknown error",
    });
  }
};

export const updateDoctorAvailability = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await doctorService.updateDoctorAvailability(userId, req.body || {});
    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update availability",
      error: error.message || "Unknown error",
    });
  }
};

export const updateAppointmentStatusForDoctor = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const appointmentId = String(req.params.appointmentId);
    const { status } = req.body;

    const appointment = await doctorService.updateAppointmentStatusForDoctor(userId, appointmentId, status);
    return res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
      appointment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to update appointment status",
      error: error.message || "Unknown error",
    });
  }
};

export const getDoctorPatientDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const patientId = String(req.params.patientId);
    const result = await doctorService.getDoctorPatientDetails(userId, patientId);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch patient details",
      error: error.message || "Unknown error",
    });
  }
};

export const markNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const notificationId = String(req.params.notificationId);
    await doctorService.markNotificationRead(userId, notificationId);
    return res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({ success: false, message: error.message || "Failed to update notification" });
  }
};

export const getMyDoctorHospitals = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const result = await doctorService.getMyDoctorHospitals(userId);
    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch doctor hospitals",
      error: error.message || "Unknown error",
    });
  }
};

export const searchHospitalsForDoctor = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { query = "" } = req.query;
    const hospitals = await doctorService.searchHospitalsForDoctor(userId, String(query));
    return res.status(200).json({
      success: true,
      hospitals,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to search hospitals",
      error: error.message || "Unknown error",
    });
  }
};

export const requestJoinHospital = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { hospitalId, department = "" } = req.body;
    const request = await doctorService.requestJoinHospital(userId, hospitalId, department);
    return res.status(201).json({
      success: true,
      message: "Join request submitted successfully. Awaiting Main Admin approval.",
      request,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to submit hospital join request",
      error: error.message || "Unknown error",
    });
  }
};
