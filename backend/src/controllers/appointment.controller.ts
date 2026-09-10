import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { appointmentService } from "../container.js";
import { MAX_BOOKING_DAYS_AHEAD } from "../services/appointment.service.js";

export { MAX_BOOKING_DAYS_AHEAD };

export const validateDoctorSlotAvailability = (args: Parameters<typeof appointmentService.validateDoctorSlotAvailability>[0]) => {
  return appointmentService.validateDoctorSlotAvailability(args);
};

export const getMyAppointments = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const appointments = await appointmentService.getMyAppointments(patientUserId);
    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch appointments",
      error: error.message || "Unknown error",
    });
  }
};

export const createAppointment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { doctor, hospital, department, appointmentDate, timeSlot, reason, type } = req.body;

    const appointment = await appointmentService.createAppointment({
      patientUserId,
      doctor,
      hospital,
      department,
      appointmentDate,
      timeSlot,
      reason,
      type,
    });

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to create appointment",
      error: error.message || "Unknown error",
    });
  }
};

export const requestAppointmentReschedule = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const doctorUserId = req.user?.id;
    if (!doctorUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { newDate, newTimeSlot, reason } = req.body;

    const appointment = await appointmentService.requestAppointmentReschedule({
      doctorUserId,
      appointmentId: String(req.params.appointmentId),
      newDate,
      newTimeSlot,
      reason,
    });

    return res.status(200).json({
      success: true,
      message: "Reschedule request sent to patient. Appointment will remain at current time until patient confirms.",
      appointment,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to request appointment reschedule",
      error: error.message || "Unknown error",
    });
  }
};

export const respondAppointmentReschedule = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    if (!patientUserId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { action } = req.body; // 'accept' | 'decline'

    const result = await appointmentService.respondAppointmentReschedule({
      patientUserId,
      appointmentId: String(req.params.appointmentId),
      action,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to respond to reschedule request",
      error: error.message || "Unknown error",
    });
  }
};

export const getBookedSlots = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { doctor, date, month } = req.query;
    const result = await appointmentService.getBookedSlots({
      doctor: typeof doctor === "string" ? doctor : undefined,
      date: typeof date === "string" ? date : undefined,
      month: typeof month === "string" ? month : undefined,
    });

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch booked slots",
      error: error.message || "Unknown error",
    });
  }
};
