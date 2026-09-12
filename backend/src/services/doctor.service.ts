import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IHospitalRepository } from "../repositories/interfaces/IHospitalRepository.js";
import { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPatientRepository } from "../repositories/interfaces/IPatientRepository.js";
import { NotificationService } from "./notification.service.js";
import { BadRequestError, NotFoundError } from "../core/errors/AppError.js";

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

export class DoctorService {
  constructor(
    private doctorRepo: IDoctorRepository,
    private appointmentRepo: IAppointmentRepository,
    private notificationRepo: INotificationRepository,
    private hospitalRepo: IHospitalRepository,
    private hospitalDoctorRepo: IHospitalDoctorRepository,
    private userRepo: IUserRepository,
    private patientRepo: IPatientRepository,
    private notificationService?: NotificationService,
  ) { }

  private pickDoctorUpdates(body: Record<string, unknown>) {
    return Object.fromEntries(
      doctorUpdateFields
        .filter((field) => body[field] !== undefined)
        .map((field) => [field, body[field]]),
    );
  }

  async getMyDoctorProfile(userId: string) {
    const doctor = await this.doctorRepo.findByUserId(userId, true);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const activeAssociations = await this.hospitalDoctorRepo.find(
      { doctor: doctor._id, status: "ACTIVE" },
      "hospital",
    );

    const docObj = doctor.toObject ? doctor.toObject() : doctor;
    return {
      ...docObj,
      affiliatedHospitals: activeAssociations.map((assoc: any) => ({
        _id: assoc.hospital?._id,
        name: assoc.hospital?.name,
        department: assoc.department,
        relationshipId: assoc._id,
        joinedAt: assoc.joinedAt,
      })),
    };
  }

  async updateMyDoctorProfile(userId: string, body: Record<string, unknown>) {
    const updates = this.pickDoctorUpdates(body);
    const doctor = await this.doctorRepo.updateByUserId(userId, updates);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }
    return doctor;
  }

  async getAvailableDoctors(filters: {
    search?: string;
    specialization?: string;
    hospital?: string;
  }) {
    const { search, specialization, hospital } = filters;

    const query: Record<string, unknown> = {
      available: true,
      active: { $ne: false },
      verificationStatus: "verified",
    };

    if (specialization && typeof specialization === "string" && specialization.trim()) {
      query.specialization = { $regex: new RegExp(`^${specialization.trim()}$`, "i") };
    }

    if (hospital && typeof hospital === "string" && hospital.trim()) {
      const activeDocIds = await this.hospitalDoctorRepo.distinct("doctor", {
        hospital: hospital.trim(),
        status: "ACTIVE",
      });

      query.$or = [
        { _id: { $in: activeDocIds } },
        { hospital: hospital.trim() },
      ];
    }

    const doctors = await this.doctorRepo.find(query, true, { createdAt: -1 });

    const doctorIds = doctors.map((d: any) => d._id);
    const activeAssociations = await this.hospitalDoctorRepo.find(
      { doctor: { $in: doctorIds }, status: "ACTIVE" },
      { path: "hospital", select: "name isActive departments" },
    );

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

    return enrichedDoctors;
  }

  async getDoctorDashboard(userId: string) {
    const doctor = await this.doctorRepo.findByUserId(userId, true);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const activeHospitalDocs = await this.hospitalDoctorRepo.find(
      { doctor: doctor._id, status: "ACTIVE" },
      { path: "hospital", select: "name isActive departments" },
    );

    const allAppointments = await this.appointmentRepo.find(
      { doctor: doctor._id },
      true,
      { appointmentDate: 1 },
    );

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
    const notifications = await this.notificationRepo.findByRecipient(userId, 10);

    const docObj = doctor.toObject ? doctor.toObject() : doctor;
    return {
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
    };
  }

  async updateDoctorAvailability(userId: string, body: Record<string, any>) {
    const { workingDays, workingHours, availableSlots, blockedDates, available } = body;

    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const availabilityUpdate: Record<string, unknown> = {};
    if (workingDays !== undefined) availabilityUpdate["availability.workingDays"] = workingDays;
    if (workingHours !== undefined) availabilityUpdate["availability.workingHours"] = workingHours;
    if (availableSlots !== undefined) availabilityUpdate["availability.availableSlots"] = availableSlots;
    if (blockedDates !== undefined) availabilityUpdate["availability.blockedDates"] = blockedDates;
    if (available !== undefined) availabilityUpdate["available"] = available;

    const updatedDoctor = await this.doctorRepo.updateByUserId(userId, availabilityUpdate);
    return {
      availability: updatedDoctor?.availability,
      available: updatedDoctor?.available,
    };
  }

  async updateAppointmentStatusForDoctor(
    userId: string,
    appointmentId: string,
    status: string,
    reason?: string,
  ) {
    if (!["completed", "cancelled", "confirmed"].includes(status)) {
      throw new BadRequestError("Invalid appointment status");
    }

    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const appointment = await this.appointmentRepo.findOne({
      _id: appointmentId,
      doctor: doctor._id,
    }, false);

    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const previousStatus = appointment.status || "scheduled";

    // Prevent duplicate processing or notifications if status did not actually change
    if (previousStatus.toLowerCase() === status.toLowerCase()) {
      return appointment;
    }

    const updatedAppointment = await this.appointmentRepo.updateStatus(appointmentId, status);
    const populated = await this.appointmentRepo.findById(appointmentId, true);

    try {
      if (this.notificationService) {
        if (status === "cancelled") {
          await this.notificationService.sendAppointmentCancellation(
            populated || appointment,
            previousStatus,
            reason,
            "doctor",
          );
        } else if (status === "confirmed") {
          await this.notificationService.sendAppointmentConfirmation(
            populated || appointment,
          );
        } else {
          await this.notificationService.sendAppointmentStatusUpdate(
            populated || appointment,
            previousStatus,
            status,
            reason,
          );
        }
      } else {
        await this.notificationRepo.create({
          recipient: appointment.patient,
          type: status === "completed" ? "system" : "cancellation",
          title: `Appointment ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: `Your appointment on ${new Date(appointment.appointmentDate).toLocaleDateString()} at ${appointment.timeSlot} was marked as ${status}.`,
          appointment: appointment._id,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create patient notification:", notifErr);
    }

    return populated || updatedAppointment;
  }

  async getDoctorPatientDetails(userId: string, patientId: string) {
    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const userObj = await this.userRepo.findById(patientId);
    const patientProfile = await this.patientRepo.findByUserId(patientId, false);

    const history = await this.appointmentRepo.find(
      { doctor: doctor._id, patient: patientId },
      true,
      { appointmentDate: -1 },
    );

    return {
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
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }

  async getMyDoctorHospitals(userId: string) {
    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const hospitalDoctors = await this.hospitalDoctorRepo.find(
      { doctor: doctor._id },
      "hospital",
      { updatedAt: -1 },
    );

    const pending = hospitalDoctors.filter((hd) => hd.status === "PENDING");
    const active = hospitalDoctors.filter((hd) => hd.status === "ACTIVE");
    const rejected = hospitalDoctors.filter((hd) => hd.status === "REJECTED");
    const removed = hospitalDoctors.filter((hd) => hd.status === "REMOVED");

    return {
      all: hospitalDoctors,
      pending,
      active,
      rejected,
      removed,
      history: hospitalDoctors,
    };
  }

  async searchHospitalsForDoctor(userId: string, query = "") {
    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const filter: Record<string, unknown> = { isActive: true };
    if (typeof query === "string" && query.trim()) {
      filter.name = { $regex: new RegExp(query.trim(), "i") };
    }

    const hospitals = await this.hospitalRepo.find(filter, { name: 1 });

    const relationships = await this.hospitalDoctorRepo.find({
      doctor: doctor._id,
      hospital: { $in: hospitals.map((h) => h._id) },
    });

    const relMap: Record<string, any> = {};
    relationships.forEach((r) => {
      const prev = relMap[String(r.hospital)];
      if (!prev || r.status === "ACTIVE" || r.status === "PENDING") {
        relMap[String(r.hospital)] = r;
      }
    });

    return hospitals.map((h) => ({
      ...h,
      myRelationship: relMap[String(h._id)] || null,
    }));
  }

  async requestJoinHospital(userId: string, hospitalId: string, department = "") {
    if (!hospitalId) {
      throw new BadRequestError("Hospital ID is required");
    }

    const doctor = await this.doctorRepo.findByUserId(userId, false);
    if (!doctor) {
      throw new NotFoundError("Doctor profile not found");
    }

    const hospital = await this.hospitalRepo.findById(hospitalId);
    if (!hospital || !hospital.isActive) {
      throw new BadRequestError("Hospital not found or is inactive");
    }

    const existing = await this.hospitalDoctorRepo.findOne({
      doctor: doctor._id,
      hospital: hospitalId,
      status: { $in: ["PENDING", "ACTIVE"] },
    });

    if (existing) {
      if (existing.status === "ACTIVE") {
        throw new BadRequestError("You are already actively associated with this hospital.");
      }
      throw new BadRequestError("You already have a pending join request for this hospital awaiting Main Admin review.");
    }

    const newRequest = await this.hospitalDoctorRepo.create({
      doctor: doctor._id,
      hospital: hospitalId,
      department: String(department).trim(),
      status: "PENDING",
      requestedBy: "DOCTOR",
    });

    return this.hospitalDoctorRepo.findById(newRequest._id, "hospital");
  }
}
