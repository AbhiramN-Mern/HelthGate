import type { Response } from "express";

import DoctorModel from "../models/doctor.model.js";
import AppointmentModel from "../models/appointment.model.js";
import NotificationModel from "../models/notification.model.js";
import PatientModel from "../models/patient.model.js";
import UserModel from "../models/user.model.js";
import HospitalModel from "../models/hospital.model.js";
import HospitalDoctorModel from "../models/hospitalDoctor.model.js";
import type { AuthenticatedRequest } from "../types/auth.js";

// Note: "hospital" is intentionally excluded from direct doctor profile update
// Doctors cannot self-associate with a hospital; they must request join, approved by Main Admin.
const doctorUpdateFields = [
  "specialization",
  "qualification",
  "profileImage",
  "experienceYears",
  "licenseNumber",
  "consultationFee",
  "available",
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

    // Fetch active affiliated hospitals from HospitalDoctor collection
    const activeAssociations = await HospitalDoctorModel.find({
      doctor: doctor._id,
      status: "ACTIVE",
    }).populate("hospital");

    const docObj = doctor.toObject();
    return res.status(200).json({
      success: true,
      doctor: {
        ...docObj,
        affiliatedHospitals: activeAssociations.map((assoc: any) => ({
          _id: assoc.hospital?._id,
          name: assoc.hospital?.name,
          department: assoc.department,
          relationshipId: assoc._id,
          joinedAt: assoc.joinedAt,
        })),
      },
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

    // If filtering by hospital, query active doctors from HospitalDoctor relationship
    if (hospital && typeof hospital === "string" && hospital.trim()) {
      const activeDocIds = await HospitalDoctorModel.find({
        hospital: hospital.trim(),
        status: "ACTIVE",
      }).distinct("doctor");

      // Also include doctors who have legacy doctor.hospital match
      query.$or = [
        { _id: { $in: activeDocIds } },
        { hospital: hospital.trim() },
      ];
    }

    let doctors = await DoctorModel.find(query)
      .populate("user", "name email role")
      .populate("hospital", "name isActive")
      .sort({ createdAt: -1 });

    // Fetch all active associations for these doctors
    const doctorIds = doctors.map((d: any) => d._id);
    const activeAssociations = await HospitalDoctorModel.find({
      doctor: { $in: doctorIds },
      status: "ACTIVE",
    }).populate("hospital", "name isActive departments");

    const doctorHospitalsMap: Record<string, any[]> = {};
    activeAssociations.forEach((assoc: any) => {
      const docId = String(assoc.doctor);
      if (!doctorHospitalsMap[docId]) doctorHospitalsMap[docId] = [];
      if (assoc.hospital) {
        doctorHospitalsMap[docId].push({
          _id: assoc.hospital._id,
          name: assoc.hospital.name,
          department: assoc.department,
          relationshipId: assoc._id,
        });
      }
    });

    let enrichedDoctors = doctors.map((d: any) => {
      const activeHospitals = doctorHospitalsMap[String(d._id)] || [];
      // Fallback: if legacy doctor.hospital exists and active, and not in activeHospitals list
      if (d.hospital && !activeHospitals.some((h) => String(h._id) === String(d.hospital._id))) {
        activeHospitals.push({
          _id: d.hospital._id,
          name: d.hospital.name,
          department: "",
        });
      }

      const docObj = d.toObject ? d.toObject() : { ...d };
      return {
        ...docObj,
        affiliatedHospitals: activeHospitals,
        isFreelance: activeHospitals.length === 0,
      };
    });

    if (search && typeof search === "string" && search.trim()) {
      const term = search.trim().toLowerCase();
      enrichedDoctors = enrichedDoctors.filter((doc: any) => {
        const docName = doc.user?.name?.toLowerCase() || "";
        const spec = doc.specialization?.toLowerCase() || "";
        const hospMatches = (doc.affiliatedHospitals || []).some((h: any) =>
          h.name?.toLowerCase().includes(term),
        );
        return docName.includes(term) || spec.includes(term) || hospMatches;
      });
    }

    return res.status(200).json({
      success: true,
      doctors: enrichedDoctors,
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

    // Active hospitals for this doctor
    const activeHospitalDocs = await HospitalDoctorModel.find({
      doctor: doctor._id,
      status: "ACTIVE",
    }).populate("hospital", "name isActive departments");

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

    const completedAppointments = allAppointments.filter((appt) => appt.status === "completed");

    // Extract unique recent patients
    const patientMap = new Map<string, any>();
    for (const appt of allAppointments) {
      const p = appt.patient as any;
      if (p?._id && !patientMap.has(p._id.toString())) {
        const patientAppointments = allAppointments.filter(
          (a) => (a.patient as any)?._id?.toString() === p._id.toString(),
        );
        patientMap.set(p._id.toString(), {
          patientId: p._id,
          name: p.name || "Patient",
          email: p.email || "",
          lastAppointmentDate: appt.appointmentDate,
          lastAppointmentStatus: appt.status,
          appointmentType: appt.type,
          totalVisits: patientAppointments.length,
        });
      }
    }

    const recentPatients = Array.from(patientMap.values()).slice(0, 5);

    // Fetch doctor notifications
    const notifications = await NotificationModel.find({
      recipient: req.user?.id,
    })
      .sort({ createdAt: -1 })
      .limit(10);

    const docObj = doctor.toObject();
    return res.status(200).json({
      success: true,
      doctor: {
        ...docObj,
        affiliatedHospitals: activeHospitalDocs.map((hd: any) => ({
          _id: hd.hospital?._id,
          name: hd.hospital?.name,
          department: hd.department,
          relationshipId: hd._id,
        })),
      },
      stats: {
        todayAppointments: todayAppointments.length,
        upcomingAppointments: upcomingAppointments.length,
        completedAppointments: completedAppointments.length,
        totalPatients: patientMap.size,
      },
      todayAppointments,
      upcomingAppointments,
      recentPatients,
      notifications,
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
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const availabilityUpdate: Record<string, unknown> = {};
    if (workingDays !== undefined) availabilityUpdate["availability.workingDays"] = workingDays;
    if (workingHours !== undefined) availabilityUpdate["availability.workingHours"] = workingHours;
    if (availableSlots !== undefined) availabilityUpdate["availability.availableSlots"] = availableSlots;
    if (blockedDates !== undefined) availabilityUpdate["availability.blockedDates"] = blockedDates;
    if (available !== undefined) availabilityUpdate["available"] = available;

    const updatedDoctor = await DoctorModel.findOneAndUpdate(
      { user: req.user?.id },
      { $set: availabilityUpdate },
      { new: true },
    );

    return res.status(200).json({
      success: true,
      message: "Availability updated successfully",
      availability: updatedDoctor?.availability,
      available: updatedDoctor?.available,
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

    if (!["completed", "cancelled", "confirmed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid appointment status" });
    }

    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const appointment = await AppointmentModel.findOne({
      _id: appointmentId,
      doctor: doctor._id,
    });

    if (!appointment) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    appointment.status = status;
    await appointment.save();

    // Create notification for patient
    try {
      await NotificationModel.create({
        recipient: appointment.patient,
        type: status === "completed" ? "system" : "cancellation",
        title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
        message: `Your appointment on ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.timeSlot} was marked as ${status}.`,
        appointment: appointment._id,
      });
    } catch (notifErr) {
      console.warn("Failed to create patient notification:", notifErr);
    }

    return res.status(200).json({
      success: true,
      message: `Appointment ${status} successfully`,
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
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
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

// ==========================================
// DOCTOR - HOSPITAL RELATIONSHIPS
// ==========================================

/**
 * Get all hospital associations for the currently logged-in doctor
 * Includes pending requests, active hospitals, rejected requests, and removal history.
 */
export const getMyDoctorHospitals = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const hospitalDoctors = await HospitalDoctorModel.find({ doctor: doctor._id })
      .populate("hospital")
      .sort({ updatedAt: -1 });

    const pending = hospitalDoctors.filter((hd) => hd.status === "PENDING");
    const active = hospitalDoctors.filter((hd) => hd.status === "ACTIVE");
    const rejected = hospitalDoctors.filter((hd) => hd.status === "REJECTED");
    const removed = hospitalDoctors.filter((hd) => hd.status === "REMOVED");

    return res.status(200).json({
      success: true,
      all: hospitalDoctors,
      pending,
      active,
      rejected,
      removed,
      history: hospitalDoctors,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch doctor hospitals",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Search active hospitals and annotate with doctor's current relationship status
 */
export const searchHospitalsForDoctor = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { query = "" } = req.query;
    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const filter: Record<string, unknown> = { isActive: true };
    if (typeof query === "string" && query.trim()) {
      filter.name = { $regex: new RegExp(query.trim(), "i") };
    }

    const hospitals = await HospitalModel.find(filter).sort({ name: 1 }).lean();

    // Get doctor's current relationships with all these hospitals
    const relationships = await HospitalDoctorModel.find({
      doctor: doctor._id,
      hospital: { $in: hospitals.map((h) => h._id) },
    }).lean();

    const relMap: Record<string, any> = {};
    relationships.forEach((r) => {
      // If multiple, prioritize PENDING/ACTIVE over REJECTED/REMOVED
      const prev = relMap[String(r.hospital)];
      if (!prev || r.status === "ACTIVE" || r.status === "PENDING") {
        relMap[String(r.hospital)] = r;
      }
    });

    const enriched = hospitals.map((h) => ({
      ...h,
      myRelationship: relMap[String(h._id)] || null,
    }));

    return res.status(200).json({
      success: true,
      hospitals: enriched,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to search hospitals",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Doctor submits a request to join a hospital.
 * Flow: Doctor requests -> Main Admin reviews -> Main Admin Approves/Rejects.
 * Doctors cannot self-approve.
 */
export const requestJoinHospital = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { hospitalId, department = "" } = req.body;
    if (!hospitalId) {
      return res.status(400).json({ success: false, message: "Hospital ID is required" });
    }

    const doctor = await DoctorModel.findOne({ user: req.user?.id });
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor profile not found" });
    }

    const hospital = await HospitalModel.findById(hospitalId);
    if (!hospital || !hospital.isActive) {
      return res.status(400).json({ success: false, message: "Hospital not found or is inactive" });
    }

    // Check if doctor already has an ACTIVE or PENDING relationship
    const existing = await HospitalDoctorModel.findOne({
      doctor: doctor._id,
      hospital: hospitalId,
      status: { $in: ["PENDING", "ACTIVE"] },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        return res.status(400).json({
          success: false,
          message: "You are already actively associated with this hospital.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "You already have a pending join request for this hospital awaiting Main Admin review.",
      });
    }

    // Create a new PENDING request. Only Main Admin can approve.
    const newRequest: any = await HospitalDoctorModel.create({
      doctor: doctor._id,
      hospital: hospitalId,
      department: String(department).trim(),
      status: "PENDING",
      requestedBy: "DOCTOR",
    });

    const populated = await HospitalDoctorModel.findById(newRequest._id).populate("hospital");

    return res.status(201).json({
      success: true,
      message: "Join request submitted successfully. Awaiting Main Admin approval.",
      request: populated,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to submit hospital join request",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
