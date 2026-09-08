import type { Response } from "express";
import AppointmentModel from "../models/appointment.model.js";
import DoctorModel from "../models/doctor.model.js";
import UserModel from "../models/user.model.js";
import NotificationModel from "../models/notification.model.js";
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

    const doctorDoc = await DoctorModel.findById(doctor);
    if (!doctorDoc) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found",
      });
    }

    if (doctorDoc.verificationStatus !== "verified") {
      return res.status(400).json({
        success: false,
        message: "This doctor is not verified and cannot accept appointments.",
      });
    }

    if (doctorDoc.available === false) {
      return res.status(400).json({
        success: false,
        message: "This doctor is currently not accepting new appointments.",
      });
    }

    const apptDateObj = new Date(appointmentDate);
    const dateStr = apptDateObj.toISOString().split("T")[0];
    const localDateStr = `${apptDateObj.getFullYear()}-${String(apptDateObj.getMonth() + 1).padStart(2, "0")}-${String(apptDateObj.getDate()).padStart(2, "0")}`;

    // Check if the doctor blocked this date
    const blockedDates = doctorDoc.availability?.blockedDates || [];
    const isBlocked =
      blockedDates.includes(dateStr) ||
      blockedDates.includes(localDateStr) ||
      (typeof appointmentDate === "string" && blockedDates.includes(appointmentDate.split("T")[0]));

    if (isBlocked) {
      return res.status(400).json({
        success: false,
        message: "Doctor has blocked this date and is on leave. Please select an available date.",
      });
    }

    // Check if appointment day is an active working day
    const workingDays = doctorDoc.availability?.workingDays || [];
    if (workingDays.length > 0) {
      const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const dayName = weekdays[apptDateObj.getDay()];
      if (!workingDays.includes(dayName)) {
        return res.status(400).json({
          success: false,
          message: `Doctor does not practice on ${dayName}s. Please choose one of their working days (${workingDays.join(", ")}).`,
        });
      }
    }

    const cleanTimeSlot = (timeSlot || "10:00 AM").trim();

    // Check if appointment date or time has already passed
    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayIso = now.toISOString().split("T")[0];

    const isPastDate = dateStr < todayLocal && dateStr < todayIso && localDateStr < todayLocal;
    if (isPastDate) {
      return res.status(400).json({
        success: false,
        message: "Cannot book an appointment on a past date.",
      });
    }

    const isToday = dateStr === todayLocal || localDateStr === todayLocal || dateStr === todayIso;
    if (isToday) {
      const match = cleanTimeSlot.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = parseInt(match[2], 10);
        const meridian = match[3]?.toUpperCase();
        if (meridian === "PM" && hours < 12) hours += 12;
        else if (meridian === "AM" && hours === 12) hours = 0;

        const slotTimeToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes, 0, 0);
        if (slotTimeToday.getTime() <= now.getTime()) {
          return res.status(400).json({
            success: false,
            message: `The time slot "${cleanTimeSlot}" has already passed today. Please choose an upcoming time slot.`,
          });
        }
      }
    }

    // Check if this time slot on this date is already booked by another patient
    const startWindow = new Date(apptDateObj);
    startWindow.setUTCHours(0, 0, 0, 0);
    const endWindow = new Date(apptDateObj);
    endWindow.setUTCHours(23, 59, 59, 999);

    const existingAppointments = await AppointmentModel.find({
      doctor,
      status: { $ne: "cancelled" },
      appointmentDate: {
        $gte: new Date(startWindow.getTime() - 24 * 60 * 60 * 1000),
        $lte: new Date(endWindow.getTime() + 24 * 60 * 60 * 1000),
      },
    }).select("appointmentDate timeSlot");

    const isSlotTaken = existingAppointments.some((appt) => {
      const apptDateIso = new Date(appt.appointmentDate).toISOString().split("T")[0];
      const apptDateLocal = `${new Date(appt.appointmentDate).getFullYear()}-${String(new Date(appt.appointmentDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.appointmentDate).getDate()).padStart(2, "0")}`;
      const matchesDate =
        apptDateIso === dateStr ||
        apptDateLocal === localDateStr ||
        apptDateIso === localDateStr ||
        apptDateLocal === dateStr;

      return matchesDate && appt.timeSlot?.trim().toLowerCase() === cleanTimeSlot.toLowerCase();
    });

    if (isSlotTaken) {
      return res.status(400).json({
        success: false,
        message: `The time slot "${cleanTimeSlot}" is already booked on this date by another patient. Please choose an available slot.`,
      });
    }

    const appointment = await AppointmentModel.create({
      patient: patientUserId,
      doctor,
      hospital: hospital || doctorDoc.hospital || null,
      appointmentDate: new Date(appointmentDate),
      timeSlot: cleanTimeSlot,
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

    // Create notification for doctor
    try {
      const doctorDoc = await DoctorModel.findById(doctor).select("user");
      if (doctorDoc?.user) {
        const patientUser = await UserModel.findById(patientUserId).select("name");
        await NotificationModel.create({
          recipient: doctorDoc.user,
          type: "new_appointment",
          title: "New Appointment Booked",
          message: `${patientUser?.name || "A patient"} booked an appointment for ${new Date(appointmentDate).toLocaleDateString()} at ${timeSlot || "10:00 AM"}.`,
          appointment: appointment._id,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create appointment notification:", notifErr);
    }

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

export const getBookedSlots = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { doctor, date, month } = req.query;

    if (!doctor || typeof doctor !== "string") {
      return res.status(400).json({
        success: false,
        message: "Doctor ID query parameter is required",
      });
    }

    const query: Record<string, unknown> = {
      doctor,
      status: { $ne: "cancelled" },
    };

    if (date && typeof date === "string") {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const appointments = await AppointmentModel.find({
        ...query,
        appointmentDate: {
          $gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(endOfDay.getTime() + 24 * 60 * 60 * 1000),
        },
      }).select("appointmentDate timeSlot");

      const dateOnly = date.split("T")[0];
      const bookedSlots = appointments
        .filter((appt) => {
          const apptIso = new Date(appt.appointmentDate).toISOString().split("T")[0];
          const localStr = `${new Date(appt.appointmentDate).getFullYear()}-${String(new Date(appt.appointmentDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.appointmentDate).getDate()).padStart(2, "0")}`;
          return apptIso === dateOnly || localStr === dateOnly;
        })
        .map((appt) => appt.timeSlot)
        .filter(Boolean);

      return res.status(200).json({
        success: true,
        doctor,
        date: dateOnly,
        bookedSlots,
      });
    }

    if (month && typeof month === "string") {
      const [y, m] = month.split("-").map(Number);
      const startMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const endMonth = new Date(Date.UTC(y, m, 1, 23, 59, 59));

      const appointments = await AppointmentModel.find({
        ...query,
        appointmentDate: {
          $gte: new Date(startMonth.getTime() - 24 * 60 * 60 * 1000),
          $lte: new Date(endMonth.getTime() + 24 * 60 * 60 * 1000),
        },
      }).select("appointmentDate timeSlot");

      const bookedSlotsByDate: Record<string, string[]> = {};
      appointments.forEach((appt) => {
        const dStr = new Date(appt.appointmentDate).toISOString().split("T")[0];
        if (!bookedSlotsByDate[dStr]) {
          bookedSlotsByDate[dStr] = [];
        }
        if (appt.timeSlot && !bookedSlotsByDate[dStr].includes(appt.timeSlot)) {
          bookedSlotsByDate[dStr].push(appt.timeSlot);
        }
      });

      return res.status(200).json({
        success: true,
        doctor,
        month,
        bookedSlotsByDate,
      });
    }

    // Default: return all active bookings for this doctor grouped by date
    const appointments = await AppointmentModel.find(query).select("appointmentDate timeSlot");
    const bookedSlotsByDate: Record<string, string[]> = {};
    appointments.forEach((appt) => {
      const dStr = new Date(appt.appointmentDate).toISOString().split("T")[0];
      if (!bookedSlotsByDate[dStr]) {
        bookedSlotsByDate[dStr] = [];
      }
      if (appt.timeSlot && !bookedSlotsByDate[dStr].includes(appt.timeSlot)) {
        bookedSlotsByDate[dStr].push(appt.timeSlot);
      }
    });

    return res.status(200).json({
      success: true,
      doctor,
      bookedSlotsByDate,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch booked slots",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

