import type { Response } from "express";
import type { Types } from "mongoose";
import AppointmentModel from "../models/appointment.model.js";
import DoctorModel from "../models/doctor.model.js";
import UserModel from "../models/user.model.js";
import NotificationModel from "../models/notification.model.js";
import HospitalModel from "../models/hospital.model.js";
import HospitalDoctorModel from "../models/hospitalDoctor.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

export const MAX_BOOKING_DAYS_AHEAD = Number(process.env.MAX_BOOKING_DAYS_AHEAD) || 90;

/**
 * Validates whether a specific doctor has an open, valid slot on a given date and timeSlot.
 * Checks doctor existence, verification, availability, blocked dates, working days,
 * past date/time, max 90-day booking window, and active/pending collision conflicts.
 */
export async function validateDoctorSlotAvailability({
  doctorId,
  date,
  timeSlot,
  excludeAppointmentId,
}: {
  doctorId: string | Types.ObjectId;
  date: Date | string;
  timeSlot: string;
  excludeAppointmentId?: string | Types.ObjectId;
}): Promise<{ available: boolean; message?: string; doctorDoc?: any }> {
  const doctorDoc = await DoctorModel.findById(doctorId);
  if (!doctorDoc) {
    return { available: false, message: "Doctor not found" };
  }

  if (doctorDoc.verificationStatus !== "verified") {
    return {
      available: false,
      message: "This doctor is not verified and cannot accept appointments.",
    };
  }

  if (doctorDoc.available === false) {
    return {
      available: false,
      message: "This doctor is currently not accepting appointments.",
    };
  }

  const apptDateObj = new Date(date);
  if (isNaN(apptDateObj.getTime())) {
    return { available: false, message: "Invalid appointment date provided." };
  }

  const dateStr = apptDateObj.toISOString().split("T")[0];
  const localDateStr = `${apptDateObj.getFullYear()}-${String(apptDateObj.getMonth() + 1).padStart(2, "0")}-${String(apptDateObj.getDate()).padStart(2, "0")}`;

  // Check if doctor blocked this date (leave / vacation)
  const blockedDates = doctorDoc.availability?.blockedDates || [];
  const isBlocked =
    blockedDates.includes(dateStr) ||
    blockedDates.includes(localDateStr) ||
    (typeof date === "string" && blockedDates.includes(date.split("T")[0]));

  if (isBlocked) {
    return {
      available: false,
      message: "Doctor has blocked this date and is on leave. Please select an available date.",
    };
  }

  // Check if appointment day is an active working day
  const workingDays = doctorDoc.availability?.workingDays || [];
  if (workingDays.length > 0) {
    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const dayName = weekdays[apptDateObj.getDay()];
    if (!workingDays.includes(dayName)) {
      return {
        available: false,
        message: `Doctor does not practice on ${dayName}s. Please choose one of their working days (${workingDays.join(", ")}).`,
      };
    }
  }

  const cleanTimeSlot = (timeSlot || "10:00 AM").trim();

  // If doctor specified explicit availableSlots, ensure cleanTimeSlot is in it
  const configuredSlots = doctorDoc.availability?.availableSlots || [];
  if (configuredSlots.length > 0) {
    const isSlotConfigured = configuredSlots.some(
      (s: string) => s.trim().toLowerCase() === cleanTimeSlot.toLowerCase(),
    );
    if (!isSlotConfigured) {
      return {
        available: false,
        message: `Selected slot "${cleanTimeSlot}" is not in the doctor's available slots schedule.`,
      };
    }
  }

  // Check if appointment date or time has already passed
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const todayIso = now.toISOString().split("T")[0];

  const isPastDate = dateStr < todayLocal && dateStr < todayIso && localDateStr < todayLocal;
  if (isPastDate) {
    return {
      available: false,
      message: "Cannot schedule an appointment on a past date.",
    };
  }

  // Check if appointment date exceeds maximum advance booking window
  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + MAX_BOOKING_DAYS_AHEAD);
  const maxDateLocal = `${maxDate.getFullYear()}-${String(maxDate.getMonth() + 1).padStart(2, "0")}-${String(maxDate.getDate()).padStart(2, "0")}`;
  const maxDateIso = maxDate.toISOString().split("T")[0];

  const isBeyondLimit = (dateStr > maxDateLocal && dateStr > maxDateIso) || localDateStr > maxDateLocal;
  if (isBeyondLimit) {
    return {
      available: false,
      message: `Appointments can only be scheduled up to ${MAX_BOOKING_DAYS_AHEAD} days in advance.`,
    };
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
        return {
          available: false,
          message: `The time slot "${cleanTimeSlot}" has already passed today. Please choose an upcoming time slot.`,
        };
      }
    }
  }

  // Check if this time slot on this date is already booked or reserved
  const query: Record<string, unknown> = {
    doctor: doctorId,
    status: { $nin: ["cancelled", "completed"] },
  };

  if (excludeAppointmentId) {
    query._id = { $ne: excludeAppointmentId };
  }

  const candidateAppointments = await AppointmentModel.find(query).select(
    "appointmentDate timeSlot rescheduleRequest",
  );

  const isSlotTaken = candidateAppointments.some((appt) => {
    // 1. Confirmed/scheduled slot
    if (appt.appointmentDate) {
      const apptDateIso = new Date(appt.appointmentDate).toISOString().split("T")[0];
      const apptDateLocal = `${new Date(appt.appointmentDate).getFullYear()}-${String(new Date(appt.appointmentDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.appointmentDate).getDate()).padStart(2, "0")}`;
      const matchesDate =
        apptDateIso === dateStr ||
        apptDateLocal === localDateStr ||
        apptDateIso === localDateStr ||
        apptDateLocal === dateStr;

      if (matchesDate && appt.timeSlot?.trim().toLowerCase() === cleanTimeSlot.toLowerCase()) {
        return true;
      }
    }

    // 2. Pending proposed reschedule slot
    if (
      appt.rescheduleRequest &&
      appt.rescheduleRequest.status === "pending" &&
      appt.rescheduleRequest.proposedDate &&
      appt.rescheduleRequest.proposedTimeSlot
    ) {
      const propDateIso = new Date(appt.rescheduleRequest.proposedDate).toISOString().split("T")[0];
      const propDateLocal = `${new Date(appt.rescheduleRequest.proposedDate).getFullYear()}-${String(new Date(appt.rescheduleRequest.proposedDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.rescheduleRequest.proposedDate).getDate()).padStart(2, "0")}`;
      const matchesPropDate =
        propDateIso === dateStr ||
        propDateLocal === localDateStr ||
        propDateIso === localDateStr ||
        propDateLocal === dateStr;

      if (
        matchesPropDate &&
        appt.rescheduleRequest.proposedTimeSlot.trim().toLowerCase() === cleanTimeSlot.toLowerCase()
      ) {
        return true;
      }
    }

    return false;
  });

  if (isSlotTaken) {
    return {
      available: false,
      message: `The time slot "${cleanTimeSlot}" is already booked or reserved on this date. Please choose another slot.`,
    };
  }

  return { available: true, doctorDoc };
}

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
      .populate("hospital", "name isActive licenseNumber address contactInfo departments")
      .populate("hospitalDoctor")
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
    const { doctor, hospital, department, appointmentDate, timeSlot, reason, type } = req.body;

    if (!doctor || !appointmentDate) {
      return res.status(400).json({
        success: false,
        message: "Doctor and appointmentDate are required",
      });
    }

    const cleanTimeSlot = (timeSlot || "10:00 AM").trim();

    // Validate slot availability using unified validator
    const validation = await validateDoctorSlotAvailability({
      doctorId: doctor,
      date: appointmentDate,
      timeSlot: cleanTimeSlot,
    });

    if (!validation.available) {
      return res.status(400).json({
        success: false,
        message: validation.message || "Selected slot is not available.",
      });
    }

    const doctorDoc = validation.doctorDoc;

    let hospitalId: any = null;
    let hospitalDoctorId: any = null;
    let selectedDepartment = "";
    let isHospitalAppointment = false;

    // Determine practice setting automatically from HospitalDoctor:
    // If a doctor has an active hospital affiliation, they work through that hospital.
    // If a doctor has no active hospital affiliation, treat them as freelance automatically.
    const activeAssocs = await HospitalDoctorModel.find({
      doctor,
      status: "ACTIVE",
    }).populate("hospital");

    if (activeAssocs && activeAssocs.length > 0) {
      // If a hospital was passed in query/filter, match it; otherwise use the doctor's active affiliation
      let chosenAffiliation = activeAssocs[0];
      if (hospital && typeof hospital === "string" && hospital.trim() && hospital.trim() !== "freelance") {
        const matched = activeAssocs.find(
          (a) => String((a.hospital as any)?._id || a.hospital) === hospital.trim(),
        );
        if (matched) {
          chosenAffiliation = matched;
        }
      }

      hospitalId = (chosenAffiliation.hospital as any)?._id || chosenAffiliation.hospital;
      hospitalDoctorId = chosenAffiliation._id;
      selectedDepartment = (department ? String(department).trim() : "") || chosenAffiliation.department || "";
      isHospitalAppointment = true;
    } else if (doctorDoc.hospital) {
      // Legacy doctor.hospital fallback
      hospitalId = doctorDoc.hospital;
      isHospitalAppointment = true;
      selectedDepartment = department ? String(department).trim() : "";
    } else {
      // No active hospital affiliation -> Automatically Freelance
      hospitalId = null;
      hospitalDoctorId = null;
      selectedDepartment = "";
      isHospitalAppointment = false;
    }

    const appointment = await AppointmentModel.create({
      patient: patientUserId,
      doctor,
      hospital: hospitalId,
      hospitalDoctor: hospitalDoctorId,
      department: selectedDepartment,
      isHospitalAppointment,
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
      .populate("hospital", "name isActive licenseNumber address contactInfo")
      .populate("hospitalDoctor");

    // Create notification for doctor
    try {
      if (doctorDoc?.user) {
        const patientUser = await UserModel.findById(patientUserId).select("name");
        await NotificationModel.create({
          recipient: doctorDoc.user,
          type: "new_appointment",
          title: "New Appointment Booked",
          message: `${patientUser?.name || "A patient"} booked an appointment for ${new Date(appointmentDate).toLocaleDateString()} at ${cleanTimeSlot}.`,
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

/**
 * Doctor initiates a reschedule request:
 * Validates proposed slot availability.
 * Does NOT change confirmed appointment silently.
 * Sets pending rescheduleRequest and creates notification for patient.
 */
export const requestAppointmentReschedule = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { appointmentId } = req.params;
    const { newDate, newTimeSlot, reason } = req.body;

    if (!newDate || !newTimeSlot) {
      return res.status(400).json({
        success: false,
        message: "New date and time slot are required for rescheduling.",
      });
    }

    const doctorUser = req.user?.id;
    const doctorDoc = await DoctorModel.findOne({ user: doctorUser });
    if (!doctorDoc) {
      return res.status(403).json({
        success: false,
        message: "Only authorized doctors can initiate this reschedule request.",
      });
    }

    const appointment = await AppointmentModel.findOne({
      _id: appointmentId,
      doctor: doctorDoc._id,
    }).populate("patient", "name email");

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this doctor.",
      });
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      return res.status(400).json({
        success: false,
        message: `Cannot reschedule an appointment that is already ${appointment.status}.`,
      });
    }

    const cleanTimeSlot = newTimeSlot.trim();

    // Validate proposed slot availability
    const validation = await validateDoctorSlotAvailability({
      doctorId: doctorDoc._id,
      date: newDate,
      timeSlot: cleanTimeSlot,
      excludeAppointmentId: appointment._id,
    });

    if (!validation.available) {
      return res.status(400).json({
        success: false,
        message: validation.message || "The requested slot is not available.",
      });
    }

    const proposedDateObj = new Date(newDate);

    // Save pending reschedule request without changing confirmed appointment date/time
    appointment.rescheduleRequest = {
      status: "pending",
      proposedDate: proposedDateObj,
      proposedTimeSlot: cleanTimeSlot,
      reason: reason?.trim() || "Doctor requested a schedule adjustment",
      requestedBy: "doctor",
      requestedAt: new Date(),
      respondedAt: null,
    };

    await appointment.save();

    const populated = await AppointmentModel.findById(appointment._id)
      .populate({
        path: "doctor",
        populate: [
          { path: "user", select: "name email role" },
          { path: "hospital", select: "name isActive" },
        ],
      })
      .populate("hospital", "name isActive")
      .populate("patient", "name email");

    // Send notification to patient
    try {
      const patientUserId = (appointment.patient as any)?._id || appointment.patient;
      const doctorName = (populated?.doctor as any)?.user?.name || "Your Doctor";
      const formattedProposedDate = proposedDateObj.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const originalDateStr = appointment.appointmentDate
        ? new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "Current date";

      await NotificationModel.create({
        recipient: patientUserId,
        type: "reschedule_request",
        title: "Appointment Reschedule Requested",
        message: `${doctorName} has requested to reschedule your appointment from ${originalDateStr} at ${appointment.timeSlot} to ${formattedProposedDate} at ${cleanTimeSlot}.${reason ? ` Reason: ${reason.trim()}` : ""}`,
        appointment: appointment._id,
      });
    } catch (notifErr) {
      console.warn("Failed to create reschedule notification for patient:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: "Reschedule request sent to patient. Appointment will remain at current time until patient confirms.",
      appointment: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to request appointment reschedule",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Patient responds to a reschedule request:
 * 'accept': Re-validates slot, updates appointmentDate & timeSlot, sets status = 'confirmed', notifies doctor.
 * 'decline': Retains original appointment schedule, sets rescheduleRequest.status = 'declined', notifies doctor.
 */
export const respondAppointmentReschedule = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { appointmentId } = req.params;
    const { action } = req.body; // 'accept' | 'decline'
    const patientUserId = req.user?.id;

    if (!action || !["accept", "decline"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Valid action ('accept' or 'decline') is required.",
      });
    }

    const appointment = await AppointmentModel.findOne({
      _id: appointmentId,
      patient: patientUserId,
    });

    if (!appointment) {
      return res.status(404).json({
        success: false,
        message: "Appointment not found for this patient.",
      });
    }

    if (
      !appointment.rescheduleRequest ||
      appointment.rescheduleRequest.status !== "pending" ||
      !appointment.rescheduleRequest.proposedDate ||
      !appointment.rescheduleRequest.proposedTimeSlot
    ) {
      return res.status(400).json({
        success: false,
        message: "No pending reschedule request found for this appointment.",
      });
    }

    const doctorDoc = await DoctorModel.findById(appointment.doctor).populate("user", "name email");
    const patientUser = await UserModel.findById(patientUserId).select("name email");
    const patientName = patientUser?.name || "The patient";

    if (action === "accept") {
      // Re-validate that the proposed slot is still free before applying
      const validation = await validateDoctorSlotAvailability({
        doctorId: appointment.doctor,
        date: appointment.rescheduleRequest.proposedDate,
        timeSlot: appointment.rescheduleRequest.proposedTimeSlot,
        excludeAppointmentId: appointment._id,
      });

      if (!validation.available) {
        return res.status(400).json({
          success: false,
          message: `The proposed slot is no longer available: ${validation.message || "Conflict detected"}. Please contact your doctor to select an alternate slot.`,
        });
      }

      // Apply the new schedule
      appointment.appointmentDate = appointment.rescheduleRequest.proposedDate;
      appointment.timeSlot = appointment.rescheduleRequest.proposedTimeSlot;
      appointment.status = "confirmed";
      appointment.rescheduleRequest.status = "accepted";
      appointment.rescheduleRequest.respondedAt = new Date();

      await appointment.save();

      // Notify doctor
      try {
        if (doctorDoc?.user) {
          const formattedDate = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          await NotificationModel.create({
            recipient: (doctorDoc.user as any)._id || doctorDoc.user,
            type: "reschedule_response",
            title: "Reschedule Request Accepted",
            message: `${patientName} has accepted the new appointment schedule for ${formattedDate} at ${appointment.timeSlot}.`,
            appointment: appointment._id,
          });
        }
      } catch (nErr) {
        console.warn("Failed to notify doctor of reschedule acceptance:", nErr);
      }

      const populated = await AppointmentModel.findById(appointment._id)
        .populate({
          path: "doctor",
          populate: [
            { path: "user", select: "name email role" },
            { path: "hospital", select: "name isActive" },
          ],
        })
        .populate("hospital", "name isActive")
        .populate("patient", "name email");

      return res.status(200).json({
        success: true,
        message: "Reschedule accepted. Your appointment has been successfully updated to the new date and time.",
        appointment: populated,
      });
    } else {
      // Action === 'decline'
      appointment.rescheduleRequest.status = "declined";
      appointment.rescheduleRequest.respondedAt = new Date();

      await appointment.save();

      // Notify doctor
      try {
        if (doctorDoc?.user) {
          const originalDate = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          await NotificationModel.create({
            recipient: (doctorDoc.user as any)._id || doctorDoc.user,
            type: "reschedule_response",
            title: "Reschedule Request Declined",
            message: `${patientName} declined the reschedule request. The appointment remains scheduled for ${originalDate} at ${appointment.timeSlot}.`,
            appointment: appointment._id,
          });
        }
      } catch (nErr) {
        console.warn("Failed to notify doctor of reschedule rejection:", nErr);
      }

      const populated = await AppointmentModel.findById(appointment._id)
        .populate({
          path: "doctor",
          populate: [
            { path: "user", select: "name email role" },
            { path: "hospital", select: "name isActive" },
          ],
        })
        .populate("hospital", "name isActive")
        .populate("patient", "name email");

      return res.status(200).json({
        success: true,
        message: "Reschedule request declined. Your original appointment date and time remain unchanged.",
        appointment: populated,
      });
    }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to respond to reschedule request",
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
      status: { $nin: ["cancelled", "completed"] },
    };

    if (date && typeof date === "string") {
      const targetDate = new Date(date);
      const startOfDay = new Date(targetDate);
      startOfDay.setUTCHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setUTCHours(23, 59, 59, 999);

      const appointments = await AppointmentModel.find({
        ...query,
        $or: [
          {
            appointmentDate: {
              $gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
              $lte: new Date(endOfDay.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          {
            "rescheduleRequest.status": "pending",
            "rescheduleRequest.proposedDate": {
              $gte: new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000),
              $lte: new Date(endOfDay.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        ],
      }).select("appointmentDate timeSlot rescheduleRequest");

      const dateOnly = date.split("T")[0];
      const bookedSet = new Set<string>();

      appointments.forEach((appt) => {
        // Active appointment slot
        if (appt.appointmentDate && appt.timeSlot) {
          const apptIso = new Date(appt.appointmentDate).toISOString().split("T")[0];
          const localStr = `${new Date(appt.appointmentDate).getFullYear()}-${String(new Date(appt.appointmentDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.appointmentDate).getDate()).padStart(2, "0")}`;
          if (apptIso === dateOnly || localStr === dateOnly) {
            bookedSet.add(appt.timeSlot);
          }
        }

        // Pending proposed slot
        if (
          appt.rescheduleRequest?.status === "pending" &&
          appt.rescheduleRequest.proposedDate &&
          appt.rescheduleRequest.proposedTimeSlot
        ) {
          const propIso = new Date(appt.rescheduleRequest.proposedDate).toISOString().split("T")[0];
          const propLocal = `${new Date(appt.rescheduleRequest.proposedDate).getFullYear()}-${String(new Date(appt.rescheduleRequest.proposedDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.rescheduleRequest.proposedDate).getDate()).padStart(2, "0")}`;
          if (propIso === dateOnly || propLocal === dateOnly) {
            bookedSet.add(appt.rescheduleRequest.proposedTimeSlot);
          }
        }
      });

      return res.status(200).json({
        success: true,
        doctor,
        date: dateOnly,
        bookedSlots: Array.from(bookedSet),
      });
    }

    if (month && typeof month === "string") {
      const [y, m] = month.split("-").map(Number);
      const startMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const endMonth = new Date(Date.UTC(y, m, 1, 23, 59, 59));

      const appointments = await AppointmentModel.find({
        ...query,
        $or: [
          {
            appointmentDate: {
              $gte: new Date(startMonth.getTime() - 24 * 60 * 60 * 1000),
              $lte: new Date(endMonth.getTime() + 24 * 60 * 60 * 1000),
            },
          },
          {
            "rescheduleRequest.status": "pending",
            "rescheduleRequest.proposedDate": {
              $gte: new Date(startMonth.getTime() - 24 * 60 * 60 * 1000),
              $lte: new Date(endMonth.getTime() + 24 * 60 * 60 * 1000),
            },
          },
        ],
      }).select("appointmentDate timeSlot rescheduleRequest");

      const bookedSlotsByDate: Record<string, string[]> = {};
      appointments.forEach((appt) => {
        // Active slot
        if (appt.appointmentDate && appt.timeSlot) {
          const dStr = new Date(appt.appointmentDate).toISOString().split("T")[0];
          if (!bookedSlotsByDate[dStr]) bookedSlotsByDate[dStr] = [];
          if (!bookedSlotsByDate[dStr].includes(appt.timeSlot)) {
            bookedSlotsByDate[dStr].push(appt.timeSlot);
          }
        }

        // Pending proposed slot
        if (
          appt.rescheduleRequest?.status === "pending" &&
          appt.rescheduleRequest.proposedDate &&
          appt.rescheduleRequest.proposedTimeSlot
        ) {
          const pStr = new Date(appt.rescheduleRequest.proposedDate).toISOString().split("T")[0];
          if (!bookedSlotsByDate[pStr]) bookedSlotsByDate[pStr] = [];
          if (!bookedSlotsByDate[pStr].includes(appt.rescheduleRequest.proposedTimeSlot)) {
            bookedSlotsByDate[pStr].push(appt.rescheduleRequest.proposedTimeSlot);
          }
        }
      });

      return res.status(200).json({
        success: true,
        doctor,
        month,
        bookedSlotsByDate,
      });
    }

    // Default: return all active bookings and reservations grouped by date
    const appointments = await AppointmentModel.find(query).select("appointmentDate timeSlot rescheduleRequest");
    const bookedSlotsByDate: Record<string, string[]> = {};
    appointments.forEach((appt) => {
      if (appt.appointmentDate && appt.timeSlot) {
        const dStr = new Date(appt.appointmentDate).toISOString().split("T")[0];
        if (!bookedSlotsByDate[dStr]) bookedSlotsByDate[dStr] = [];
        if (!bookedSlotsByDate[dStr].includes(appt.timeSlot)) {
          bookedSlotsByDate[dStr].push(appt.timeSlot);
        }
      }
      if (
        appt.rescheduleRequest?.status === "pending" &&
        appt.rescheduleRequest.proposedDate &&
        appt.rescheduleRequest.proposedTimeSlot
      ) {
        const pStr = new Date(appt.rescheduleRequest.proposedDate).toISOString().split("T")[0];
        if (!bookedSlotsByDate[pStr]) bookedSlotsByDate[pStr] = [];
        if (!bookedSlotsByDate[pStr].includes(appt.rescheduleRequest.proposedTimeSlot)) {
          bookedSlotsByDate[pStr].push(appt.rescheduleRequest.proposedTimeSlot);
        }
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
