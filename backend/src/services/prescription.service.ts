import type { Types } from "mongoose";
import type { IPrescriptionRepository } from "../repositories/interfaces/IPrescriptionRepository.js";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors/AppError.js";

export interface SavePrescriptionInput {
  appointmentId: string | Types.ObjectId;
  doctorUserId: string;
  diagnosis: string;
  medicines: Array<{
    name: string;
    dosage?: string;
    frequency?: string;
    duration?: string;
    instructions?: string;
  }>;
  additionalAdvice?: string;
  followUpDate?: string | Date | null;
}

export class PrescriptionService {
  constructor(
    private prescriptionRepo: IPrescriptionRepository,
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo?: IDoctorRepository,
  ) {}

  /**
   * Resolve Doctor User ID and Patient User ID from appointment document
   */
  private async resolveAppointmentUsers(appointment: any): Promise<{
    patientUserId: string;
    doctorUserId: string;
    doctorId: string;
  }> {
    let patientUserId = "";
    if (appointment.patient && typeof appointment.patient === "object") {
      patientUserId = String(appointment.patient._id || appointment.patient.id);
    } else if (appointment.patient) {
      patientUserId = String(appointment.patient);
    }

    let doctorUserId = "";
    let doctorId = "";
    const docObj = appointment.doctor;
    if (docObj && typeof docObj === "object") {
      doctorId = String(docObj._id || docObj.id);
      if (docObj.user && typeof docObj.user === "object") {
        doctorUserId = String(docObj.user._id || docObj.user.id);
      } else if (docObj.user) {
        doctorUserId = String(docObj.user);
      }
    } else if (docObj) {
      doctorId = String(docObj);
    }

    if (!doctorUserId && doctorId && this.doctorRepo) {
      try {
        const docDoc = await this.doctorRepo.findById(doctorId, true);
        if (docDoc) {
          if (docDoc.user && typeof docDoc.user === "object") {
            doctorUserId = String(docDoc.user._id || docDoc.user.id);
          } else if (docDoc.user) {
            doctorUserId = String(docDoc.user);
          }
        }
      } catch (err) {
        console.warn("[PrescriptionService] Error resolving doctor user:", err);
      }
    }

    return { patientUserId, doctorUserId, doctorId };
  }

  /**
   * Doctor creates or updates a prescription for an appointment
   */
  async createOrUpdatePrescription(input: SavePrescriptionInput) {
    const {
      appointmentId,
      doctorUserId,
      diagnosis,
      medicines,
      additionalAdvice = "",
      followUpDate = null,
    } = input;

    if (!appointmentId) {
      throw new BadRequestError("Appointment ID is required");
    }

    if (!diagnosis || !diagnosis.trim()) {
      throw new BadRequestError("Diagnosis / Clinical notes are required");
    }

    if (!Array.isArray(medicines) || medicines.length === 0) {
      throw new BadRequestError("At least one medicine must be added to the prescription");
    }

    for (let i = 0; i < medicines.length; i++) {
      const med = medicines[i];
      if (!med || !med.name || !med.name.trim()) {
        throw new BadRequestError(`Medicine at position ${i + 1} must have a valid name`);
      }
    }

    const appointment = await this.appointmentRepo.findById(appointmentId, true);
    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const { patientUserId, doctorUserId: resolvedDoctorUserId, doctorId } =
      await this.resolveAppointmentUsers(appointment);

    if (!resolvedDoctorUserId || resolvedDoctorUserId !== doctorUserId.toString()) {
      throw new ForbiddenError(
        "Unauthorized: Only the assigned doctor can create or edit prescriptions for this appointment.",
      );
    }

    const sanitizedMedicines = medicines.map((m) => ({
      name: m.name.trim(),
      dosage: (m.dosage || "").trim(),
      frequency: (m.frequency || "").trim(),
      duration: (m.duration || "").trim(),
      instructions: (m.instructions || "").trim(),
    }));

    const parsedFollowUpDate = followUpDate ? new Date(followUpDate) : null;

    // Check if prescription already exists for this appointment
    const existing = await this.prescriptionRepo.findByAppointmentId(appointmentId, false);

    let prescription;
    if (existing) {
      prescription = await this.prescriptionRepo.updateByAppointmentId(appointmentId, {
        diagnosis: diagnosis.trim(),
        medicines: sanitizedMedicines,
        additionalAdvice: (additionalAdvice || "").trim(),
        followUpDate: parsedFollowUpDate,
      });
    } else {
      prescription = await this.prescriptionRepo.create({
        appointment: appointment._id,
        patient: patientUserId as any,
        doctor: doctorId as any,
        diagnosis: diagnosis.trim(),
        medicines: sanitizedMedicines,
        additionalAdvice: (additionalAdvice || "").trim(),
        followUpDate: parsedFollowUpDate,
      });
    }

    // Automatically mark the appointment as completed if not already
    const statusNormalized = (appointment.status || "").toLowerCase();
    if (statusNormalized !== "completed" && statusNormalized !== "cancelled") {
      await this.appointmentRepo.findByIdAndUpdate(appointment._id, {
        status: "completed",
      });
    }

    // Return populated prescription
    return this.prescriptionRepo.findByAppointmentId(appointment._id, true);
  }

  /**
   * Get prescription for a specific appointment with access verification
   */
  async getPrescriptionByAppointment({
    appointmentId,
    userId,
    userRole,
  }: {
    appointmentId: string | Types.ObjectId;
    userId: string;
    userRole: string;
  }) {
    if (!appointmentId) {
      throw new BadRequestError("Appointment ID is required");
    }

    const appointment = await this.appointmentRepo.findById(appointmentId, true);
    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const { patientUserId, doctorUserId } = await this.resolveAppointmentUsers(appointment);

    // Patient isolation & Doctor isolation: Only the patient, assigned doctor, or admin can view
    const isPatient = patientUserId === userId.toString();
    const isDoctor = doctorUserId === userId.toString();
    const isAdmin = userRole === "admin";

    if (!isPatient && !isDoctor && !isAdmin) {
      throw new ForbiddenError("Unauthorized: You do not have permission to view this prescription.");
    }

    const prescription = await this.prescriptionRepo.findByAppointmentId(appointment._id, true);
    return prescription;
  }

  /**
   * Get all prescriptions for the logged-in patient or doctor
   */
  async getMyPrescriptions({
    userId,
    userRole,
    limit = 50,
    skip = 0,
  }: {
    userId: string;
    userRole: string;
    limit?: number;
    skip?: number;
  }) {
    if (userRole === "patient") {
      return this.prescriptionRepo.findByPatientId(userId, limit, skip);
    }

    if (userRole === "doctor" && this.doctorRepo) {
      const docRecord = await this.doctorRepo.findOne({ user: userId });
      if (!docRecord) {
        return [];
      }
      return this.prescriptionRepo.findByDoctorId(docRecord._id, limit, skip);
    }

    return [];
  }
}
