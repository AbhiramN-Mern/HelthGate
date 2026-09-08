import type { Response } from "express";

import DoctorModel from "../models/doctor.model.js";
import AppointmentModel from "../models/appointment.model.js";
import NotificationModel from "../models/notification.model.js";
import PatientModel from "../models/patient.model.js";
import UserModel from "../models/user.model.js";
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
  "availability",
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
      verificationStatus: "verified",
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

export const getDoctorDashboard = async (
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

    const allAppointments = await AppointmentModel.find({ doctor: doctor._id })
      .populate("patient", "name email")
      .populate("hospital", "name isActive")
      .sort({ appointmentDate: 1 });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const todayAppointments = allAppointments.filter((appt) => {
      const d = new Date(appt.appointmentDate);
      return d >= startOfToday && d <= endOfToday && appt.status !== "cancelled";
    });

    const upcomingAppointments = allAppointments.filter((appt) => {
      const d = new Date(appt.appointmentDate);
      return d > endOfToday && appt.status !== "cancelled";
    });

    const completedAppointments = allAppointments.filter(
      (appt) => appt.status === "completed",
    );

    // Total Unique Patients
    const patientMap = new Map<
      string,
      {
        patientId: string;
        name: string;
        email: string;
        lastAppointmentDate: string;
        lastAppointmentStatus: string;
        appointmentType: string;
        totalVisits: number;
      }
    >();

    for (const appt of allAppointments) {
      const p = appt.patient as any;
      if (!p?._id) continue;
      const pid = p._id.toString();

      if (!patientMap.has(pid)) {
        patientMap.set(pid, {
          patientId: pid,
          name: p.name || "Patient",
          email: p.email || "",
          lastAppointmentDate: appt.appointmentDate.toISOString(),
          lastAppointmentStatus: appt.status || "scheduled",
          appointmentType: appt.type || "In-Person",
          totalVisits: 1,
        });
      } else {
        const item = patientMap.get(pid)!;
        item.totalVisits += 1;
        if (new Date(appt.appointmentDate) > new Date(item.lastAppointmentDate)) {
          item.lastAppointmentDate = appt.appointmentDate.toISOString();
          item.lastAppointmentStatus = appt.status || "scheduled";
          item.appointmentType = appt.type || "In-Person";
        }
      }
    }

    const recentPatients = Array.from(patientMap.values())
      .sort((a, b) => new Date(b.lastAppointmentDate).getTime() - new Date(a.lastAppointmentDate).getTime())
      .slice(0, 10);

    // Fetch Notifications for Doctor
    let notifications = await NotificationModel.find({ recipient: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(10);

    // If notifications collection is empty for this doctor, create notifications from recent appointments
    if (notifications.length === 0 && allAppointments.length > 0) {
      const generated = allAppointments.slice(0, 5).map((appt) => {
        const p = appt.patient as any;
        return {
          _id: `gen-${appt._id}`,
          recipient: req.user?.id,
          type: appt.status === "cancelled" ? "cancellation" : "new_appointment",
          title: appt.status === "cancelled" ? "Appointment Cancelled" : "New Appointment",
          message: `${p?.name || "A patient"} has ${appt.status === "cancelled" ? "cancelled" : "scheduled"} a ${appt.type || "consultation"} on ${new Date(appt.appointmentDate).toLocaleDateString()} at ${appt.timeSlot || "10:00 AM"}.`,
          isRead: false,
          createdAt: (appt as any).createdAt || new Date(),
        };
      });
      notifications = generated as any;
    }

    const stats = {
      todayAppointments: todayAppointments.length,
      upcomingAppointments: upcomingAppointments.length,
      completedAppointments: completedAppointments.length,
      totalPatients: patientMap.size,
    };

    const availability = doctor.availability || {
      workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
      workingHours: { start: "09:00 AM", end: "05:00 PM" },
      availableSlots: ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"],
      blockedDates: [],
    };

    return res.status(200).json({
      success: true,
      doctor,
      stats,
      todayAppointments,
      upcomingAppointments,
      recentPatients,
      notifications,
      availability,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctor dashboard",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateDoctorAvailability = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { workingDays, workingHours, availableSlots, blockedDates, available } = req.body;

    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    if (available !== undefined) {
      doctor.available = Boolean(available);
    }

    doctor.availability = {
      workingDays: Array.isArray(workingDays) ? workingDays : doctor.availability?.workingDays || [],
      workingHours: {
        start: workingHours?.start || doctor.availability?.workingHours?.start || "09:00 AM",
        end: workingHours?.end || doctor.availability?.workingHours?.end || "05:00 PM",
      },
      availableSlots: Array.isArray(availableSlots) ? availableSlots : doctor.availability?.availableSlots || [],
      blockedDates: Array.isArray(blockedDates) ? blockedDates : doctor.availability?.blockedDates || [],
    };

    await doctor.save();

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      availability: doctor.availability,
      available: doctor.available,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update availability",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateAppointmentStatusForDoctor = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { appointmentId } = req.params;
    const { status } = req.body;

    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const appointment = await AppointmentModel.findOne({
      _id: appointmentId,
      doctor: doctor._id,
    }).populate("patient", "name email");

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    appointment.status = status;
    await appointment.save();

    try {
      await NotificationModel.create({
        recipient: req.user?.id,
        type: status === "cancelled" ? "cancellation" : "general",
        title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Appointment with ${(appointment.patient as any)?.name || "Patient"} updated to ${status}.`,
        appointment: appointment._id,
      });
    } catch (nErr) {
      console.warn("Failed to create status notification:", nErr);
    }

    return res.status(200).json({
      success: true,
      message: `Appointment updated to ${status}`,
      appointment,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to update appointment status",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getDoctorPatientDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { patientId } = req.params;
    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const userObj = await UserModel.findById(patientId).select("name email");
    const patientProfile = await PatientModel.findOne({ user: patientId }).select("gender phone bloodGroup dateOfBirth address");

    const history = await AppointmentModel.find({
      doctor: doctor._id,
      patient: patientId,
    }).sort({ appointmentDate: -1 });

    return res.status(200).json({
      success: true,
      patient: {
        id: patientId,
        name: userObj?.name || "Patient",
        email: userObj?.email || "",
        gender: patientProfile?.gender || "Not specified",
        phone: patientProfile?.phone || "Not provided",
        bloodGroup: patientProfile?.bloodGroup || "Not specified",
        dateOfBirth: patientProfile?.dateOfBirth || "Not provided",
        address: patientProfile?.address || "",
      },
      appointments: history,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch patient details",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const markNotificationRead = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { notificationId } = req.params;
    await NotificationModel.findOneAndUpdate(
      { _id: notificationId, recipient: req.user?.id },
      { $set: { isRead: true } }
    );
    return res.status(200).json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Failed to update notification" });
  }
};
