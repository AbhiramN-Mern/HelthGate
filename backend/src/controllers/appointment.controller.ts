import type { Response } from "express";
import AppointmentModel from "../models/appointment.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

export const getMyAppointments = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;

    if (!patientUserId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const appointments = await AppointmentModel.find({
      patient: patientUserId,
      status: { $in: ["scheduled", "confirmed"] },
    })
      .populate({
        path: "doctor",
        populate: [
          { path: "user", select: "name email role" },
          { path: "hospital", select: "name isActive" },
        ],
      })
      .populate("hospital", "name isActive")
      .sort({ appointmentDate: 1 });

    return res.status(200).json({
      success: true,
      appointments,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch appointments",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const createAppointment = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const patientUserId = req.user?.id;
    const { doctor, hospital, appointmentDate, timeSlot, reason, type } = req.body;

    if (!doctor || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "Doctor and appointmentDate are required",
      });
    }

    const appointment = await AppointmentModel.create({
      patient: patientUserId,
      doctor,
      hospital: hospital || null,
      appointmentDate: new Date(appointmentDate),
      timeSlot: timeSlot || "10:00 AM",
      reason: reason || "General Consultation",
      type: type || "In-Person",
      status: "scheduled",
    });

    const populated = await AppointmentModel.findById(appointment._id)
      .populate({
        path: "doctor",
        populate: [
          { path: "user", select: "name email role" },
          { path: "hospital", select: "name isActive" },
        ],
      })
      .populate("hospital", "name isActive");

    return res.status(201).json({
      success: true,
      message: "Appointment booked successfully",
      appointment: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to create appointment",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
