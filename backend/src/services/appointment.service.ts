import type { Types } from "mongoose";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { NotificationService } from "./notification.service.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../core/errors/AppError.js";
import { createPaginatedResponse } from "../utils/pagination.js";

export const MAX_BOOKING_DAYS_AHEAD = Number(process.env.MAX_BOOKING_DAYS_AHEAD) || 90;

export class AppointmentService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private hospitalDoctorRepo: IHospitalDoctorRepository,
    private notificationRepo: INotificationRepository,
    private userRepo: IUserRepository,
    private notificationService?: NotificationService,
  ) { }

  async validateDoctorSlotAvailability({
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
    const doctorDoc = await this.doctorRepo.findById(doctorId, true);
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

    const configuredSlots =
      doctorDoc.availability?.availableSlots && doctorDoc.availability.availableSlots.length > 0
        ? doctorDoc.availability.availableSlots
        : ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"];

    const isSlotConfigured = configuredSlots.some(
      (s: string) => s.trim().toLowerCase() === cleanTimeSlot.toLowerCase(),
    );
    if (!isSlotConfigured) {
      return {
        available: false,
        message: `Selected slot "${cleanTimeSlot}" is not in the doctor's added time slots. The appointment time slot must be one of the doctor's added slots (${configuredSlots.join(", ")}).`,
      };
    }

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

    const query: Record<string, unknown> = {
      doctor: doctorId,
      status: { $nin: ["cancelled", "completed"] },
    };

    if (excludeAppointmentId) {
      query._id = { $ne: excludeAppointmentId };
    }

    const candidateAppointments = await this.appointmentRepo.find(
      query,
      false,
      { appointmentDate: 1 },
      "appointmentDate timeSlot rescheduleRequest",
    );

    const isSlotTaken = candidateAppointments.some((appt) => {
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

  async getMyAppointments(
    options: string | { patientUserId: string; page?: number; limit?: number; status?: string },
  ) {
    const patientUserId = typeof options === "string" ? options : options.patientUserId;
    const page = typeof options === "string" ? 1 : options.page ?? 1;
    const limit = typeof options === "string" ? 1000 : options.limit ?? 10;
    const status = typeof options === "string" ? undefined : options.status;

    const filter: Record<string, unknown> = { patient: patientUserId };
    if (status && status !== "all") {
      filter.status = status;
    }

    const total = await this.appointmentRepo.count(filter);
    const skip = (Math.max(page, 1) - 1) * limit;
    const appointments = await this.appointmentRepo.find(
      filter,
      true,
      { appointmentDate: -1 },
      undefined,
      limit,
      skip,
    );

    return createPaginatedResponse(appointments, total, page, limit);
  }

  async createAppointment(data: {
    patientUserId: string;
    doctor: string;
    hospital?: string;
    department?: string;
    appointmentDate: string | Date;
    timeSlot?: string;
    reason?: string;
    type?: string;
  }) {
    const { patientUserId, doctor, hospital, department, appointmentDate, timeSlot, reason, type } = data;

    if (!doctor || !appointmentDate) {
      throw new BadRequestError("Doctor and appointmentDate are required");
    }

    const cleanTimeSlot = (timeSlot || "10:00 AM").trim();

    const validation = await this.validateDoctorSlotAvailability({
      doctorId: doctor,
      date: appointmentDate,
      timeSlot: cleanTimeSlot,
    });

    if (!validation.available) {
      throw new BadRequestError(validation.message || "Selected slot is not available.");
    }

    const doctorDoc = validation.doctorDoc;

    let hospitalId: any = null;
    let hospitalDoctorId: any = null;
    let selectedDepartment = "";
    let isHospitalAppointment = false;

    const activeAssocs = await this.hospitalDoctorRepo.find(
      { doctor, status: "ACTIVE" },
      "hospital",
    );

    if (activeAssocs && activeAssocs.length > 0) {
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
      hospitalId = doctorDoc.hospital;
      isHospitalAppointment = true;
      selectedDepartment = department ? String(department).trim() : "";
    } else {
      hospitalId = null;
      hospitalDoctorId = null;
      selectedDepartment = "";
      isHospitalAppointment = false;
    }

    const appointment = await this.appointmentRepo.create({
      patient: patientUserId as any,
      doctor: doctor as any,
      hospital: hospitalId,
      hospitalDoctor: hospitalDoctorId,
      department: selectedDepartment,
      isHospitalAppointment,
      appointmentDate: new Date(appointmentDate),
      timeSlot: cleanTimeSlot,
      reason: reason || "General Consultation",
      type: (type as any) || "In-Person",
      status: "pending_payment",
    });

    const populated = await this.appointmentRepo.findById(appointment._id, true);

    try {
      if (doctorDoc?.user) {
        const patientUser = await this.userRepo.findById(patientUserId);
        await this.notificationRepo.create({
          recipient: doctorDoc.user,
          type: "new_appointment",
          title: "New Appointment Booked (Pending Payment)",
          message: `${patientUser?.name || "A patient"} initiated an appointment booking for ${new Date(appointmentDate).toLocaleDateString()} at ${cleanTimeSlot} (Payment Pending).`,
          appointment: appointment._id,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create appointment notification:", notifErr);
    }

    return populated;
  }

  async requestAppointmentReschedule(data: {
    doctorUserId: string;
    appointmentId: string;
    newDate: string | Date;
    newTimeSlot: string;
    reason?: string;
  }) {
    const { doctorUserId, appointmentId, newDate, newTimeSlot, reason } = data;

    if (!newDate || !newTimeSlot) {
      throw new BadRequestError("New date and time slot are required for rescheduling.");
    }

    const doctorDoc = await this.doctorRepo.findByUserId(doctorUserId, false);
    if (!doctorDoc) {
      throw new ForbiddenError("Only authorized doctors can initiate this reschedule request.");
    }

    const appointment = await this.appointmentRepo.findOne({
      _id: appointmentId,
      doctor: doctorDoc._id,
    }, true);

    if (!appointment) {
      throw new NotFoundError("Appointment not found for this doctor.");
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      throw new BadRequestError(`Cannot reschedule an appointment that is already ${appointment.status}.`);
    }

    const cleanTimeSlot = newTimeSlot.trim();

    const validation = await this.validateDoctorSlotAvailability({
      doctorId: doctorDoc._id,
      date: newDate,
      timeSlot: cleanTimeSlot,
      excludeAppointmentId: appointment._id,
    });

    if (!validation.available) {
      throw new BadRequestError(validation.message || "The requested slot is not available.");
    }

    const proposedDateObj = new Date(newDate);

    const actionHistoryItem = {
      action: "reschedule_requested_by_doctor",
      initiatedBy: doctorUserId,
      initiatedByRole: "doctor",
      approvalStatus: "pending_patient_approval",
      timestamp: new Date(),
      details: {
        proposedDate: proposedDateObj,
        proposedTimeSlot: cleanTimeSlot,
        reason: reason?.trim() || "Doctor requested a schedule adjustment",
      },
    };

    const rescheduleData = {
      status: "pending",
      approvalStatus: "pending_patient_approval",
      proposedDate: proposedDateObj,
      proposedTimeSlot: cleanTimeSlot,
      reason: reason?.trim() || "Doctor requested a schedule adjustment",
      requestedBy: "doctor",
      requestedByRole: "doctor",
      requestedByUser: doctorUserId,
      requestedAt: new Date(),
      respondedAt: null,
    };

    await this.appointmentRepo.updateRescheduleRequest(appointment._id, rescheduleData);

    if (this.appointmentRepo.findByIdAndUpdate) {
      await this.appointmentRepo.findByIdAndUpdate(appointment._id, {
        $push: { actionHistory: actionHistoryItem },
      });
    }


    const populated = await this.appointmentRepo.findById(appointment._id, true);

    try {
      if (this.notificationService) {
        await this.notificationService.sendAppointmentRescheduleRequest(
          populated || appointment,
          proposedDateObj,
          cleanTimeSlot,
          reason?.trim(),
        );
      } else {
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

        await this.notificationRepo.create({
          recipient: patientUserId,
          type: "reschedule_request",
          title: "Appointment Reschedule Requested (Pending Your Approval)",
          message: `Dr. ${doctorName} requested to reschedule your appointment from ${originalDateStr} at ${appointment.timeSlot} to ${formattedProposedDate} at ${cleanTimeSlot}.${reason ? ` Reason: ${reason.trim()}` : ""} Please log in to accept or decline.`,
          appointment: appointment._id,
        });
      }
    } catch (notifErr) {
      console.warn("Failed to create reschedule notification for patient:", notifErr);
    }

    return populated;
  }

  async respondAppointmentReschedule(data: {
    patientUserId: string;
    appointmentId: string;
    action: "accept" | "decline";
  }) {
    const { patientUserId, appointmentId, action } = data;

    if (!action || !["accept", "decline"].includes(action)) {
      throw new BadRequestError("Valid action ('accept' or 'decline') is required.");
    }

    const appointment = await this.appointmentRepo.findOne({
      _id: appointmentId,
      patient: patientUserId,
    }, false);

    if (!appointment) {
      throw new NotFoundError("Appointment not found for this patient.");
    }

    if (
      !appointment.rescheduleRequest ||
      appointment.rescheduleRequest.status !== "pending" ||
      !appointment.rescheduleRequest.proposedDate ||
      !appointment.rescheduleRequest.proposedTimeSlot
    ) {
      throw new BadRequestError("No pending reschedule request found for this appointment.");
    }

    const doctorDoc = await this.doctorRepo.findById(appointment.doctor, true);
    const patientUser = await this.userRepo.findById(patientUserId);
    const patientName = patientUser?.name || "The patient";

    if (action === "accept") {
      const validation = await this.validateDoctorSlotAvailability({
        doctorId: appointment.doctor,
        date: appointment.rescheduleRequest.proposedDate,
        timeSlot: appointment.rescheduleRequest.proposedTimeSlot,
        excludeAppointmentId: appointment._id,
      });

      if (!validation.available) {
        throw new BadRequestError(
          `The proposed slot is no longer available: ${validation.message || "Conflict detected"}. Please contact your doctor to select an alternate slot.`,
        );
      }

      const previousDate = appointment.appointmentDate;
      const previousTimeSlot = appointment.timeSlot;

      const actionHistoryItem = {
        action: "reschedule_accepted_by_patient",
        initiatedBy: patientUserId,
        initiatedByRole: "patient",
        approvalStatus: "approved",
        timestamp: new Date(),
        details: {
          previousDate,
          previousTimeSlot,
          newDate: appointment.rescheduleRequest.proposedDate,
          newTimeSlot: appointment.rescheduleRequest.proposedTimeSlot,
        },
      };

      await this.appointmentRepo.applyReschedule(
        appointment._id,
        appointment.rescheduleRequest.proposedDate,
        appointment.rescheduleRequest.proposedTimeSlot,
        {
          ...appointment.rescheduleRequest,
          status: "accepted",
          approvalStatus: "approved",
          respondedAt: new Date(),
        },
        actionHistoryItem,
      );

      const populated = await this.appointmentRepo.findById(appointment._id, true);

      try {
        if (this.notificationService) {
          await this.notificationService.sendAppointmentRescheduleConfirmed(
            populated || appointment,
            previousDate,
            previousTimeSlot,
          );
        } else if (doctorDoc?.user) {
          const formattedDate = new Date(appointment.rescheduleRequest.proposedDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          await this.notificationRepo.create({
            recipient: (doctorDoc.user as any)._id || doctorDoc.user,
            type: "reschedule_response",
            title: "Reschedule Request Accepted",
            message: `${patientName} has accepted the new appointment schedule for ${formattedDate} at ${appointment.rescheduleRequest.proposedTimeSlot}.`,
            appointment: appointment._id,
          });
        }
      } catch (nErr) {
        console.warn("Failed to notify doctor of reschedule acceptance:", nErr);
      }
      return {
        message: "Reschedule accepted. Your appointment has been successfully updated to the new date and time.",
        appointment: populated,
      };
    } else {
      const actionHistoryItem = {
        action: "reschedule_declined_by_patient",
        initiatedBy: patientUserId,
        initiatedByRole: "patient",
        approvalStatus: "rejected",
        timestamp: new Date(),
        details: {
          originalDate: appointment.appointmentDate,
          originalTimeSlot: appointment.timeSlot,
        },
      };

      const updatedReschedule = {
        ...appointment.rescheduleRequest,
        status: "declined",
        approvalStatus: "rejected",
        respondedAt: new Date(),
      };

      await this.appointmentRepo.updateRescheduleRequest(appointment._id, updatedReschedule);

      if (this.appointmentRepo.findByIdAndUpdate) {
        await this.appointmentRepo.findByIdAndUpdate(appointment._id, {
          $push: { actionHistory: actionHistoryItem },
        });
      }


      try {
        if (doctorDoc?.user) {
          const originalDate = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
          await this.notificationRepo.create({
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

      const populated = await this.appointmentRepo.findById(appointment._id, true);
      return {
        message: "Reschedule request declined. Your original appointment date and time remain unchanged.",
        appointment: populated,
      };
    }
  }

  async getBookedSlots(filters: { doctor?: string; date?: string; month?: string }) {
    const { doctor, date, month } = filters;

    if (!doctor || typeof doctor !== "string") {
      throw new BadRequestError("Doctor ID query parameter is required");
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

      const appointments = await this.appointmentRepo.find(
        {
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
        },
        false,
        { appointmentDate: 1 },
        "appointmentDate timeSlot rescheduleRequest",
      );

      const dateOnly = date.split("T")[0];
      const bookedSet = new Set<string>();

      appointments.forEach((appt) => {
        if (appt.appointmentDate && appt.timeSlot) {
          const apptIso = new Date(appt.appointmentDate).toISOString().split("T")[0];
          const localStr = `${new Date(appt.appointmentDate).getFullYear()}-${String(new Date(appt.appointmentDate).getMonth() + 1).padStart(2, "0")}-${String(new Date(appt.appointmentDate).getDate()).padStart(2, "0")}`;
          if (apptIso === dateOnly || localStr === dateOnly) {
            bookedSet.add(appt.timeSlot);
          }
        }

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

      let doctorAddedSlots: string[] = [];
      try {
        const docRecord = await this.doctorRepo.findById(doctor, false);
        if (docRecord?.availability?.availableSlots && docRecord.availability.availableSlots.length > 0) {
          doctorAddedSlots = docRecord.availability.availableSlots;
        } else {
          doctorAddedSlots = ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"];
        }
      } catch {
        doctorAddedSlots = ["09:00 AM", "10:00 AM", "11:30 AM", "02:00 PM", "03:30 PM", "05:00 PM"];
      }

      return {
        doctor,
        date: dateOnly,
        bookedSlots: Array.from(bookedSet),
        availableSlots: doctorAddedSlots,
      };
    }

    if (month && typeof month === "string") {
      const [y, m] = month.split("-").map(Number);
      const startMonth = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
      const endMonth = new Date(Date.UTC(y, m, 1, 23, 59, 59));

      const appointments = await this.appointmentRepo.find(
        {
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
        },
        false,
        { appointmentDate: 1 },
        "appointmentDate timeSlot rescheduleRequest",
      );

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

      return {
        doctor,
        month,
        bookedSlotsByDate,
      };
    }

    const appointments = await this.appointmentRepo.find(
      query,
      false,
      { appointmentDate: 1 },
      "appointmentDate timeSlot rescheduleRequest",
    );
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

    return {
      doctor,
      bookedSlotsByDate,
    };
  }

  async cancelAppointment(data: {
    patientUserId?: string;
    appointmentId: string;
    reason?: string;
    cancelledByRole?: "patient" | "admin";
    cancelledByUserId?: string;
  }) {
    const { patientUserId, appointmentId, reason, cancelledByRole = "patient", cancelledByUserId } = data;

    const query: Record<string, unknown> = { _id: appointmentId };
    if (cancelledByRole === "patient") {
      if (!patientUserId) {
        throw new BadRequestError("Patient user ID is required for patient cancellation.");
      }
      query.patient = patientUserId;
    }

    const appointment = await this.appointmentRepo.findOne(query, false);

    if (!appointment) {
      throw new NotFoundError(
        cancelledByRole === "patient"
          ? "Appointment not found for this patient"
          : "Appointment not found",
      );
    }

    if (appointment.status === "completed") {
      throw new BadRequestError("Cannot cancel an appointment that is already completed.");
    }

    const previousStatus = appointment.status || "scheduled";

    // Idempotent: avoid duplicate processing if already cancelled
    if (previousStatus.toLowerCase() === "cancelled") {
      const existingPopulated = await this.appointmentRepo.findById(appointmentId, true);
      return existingPopulated || appointment;
    }

    const initiatorId = cancelledByUserId || patientUserId;
    const actionHistoryItem = {
      action: cancelledByRole === "admin" ? "cancelled_by_admin" : "cancelled_by_patient",
      initiatedBy: initiatorId,
      initiatedByRole: cancelledByRole,
      approvalStatus: "not_required",
      timestamp: new Date(),
      details: { reason: reason?.trim() },
    };

    if (this.appointmentRepo.cancelWithAudit) {
      await this.appointmentRepo.cancelWithAudit(appointmentId, {
        cancelledBy: cancelledByRole,
        cancelledByUser: initiatorId,
        cancelledAt: new Date(),
        cancellationReason: reason?.trim() || (cancelledByRole === "admin" ? "Administrative cancellation" : "Patient requested cancellation"),
        actionHistoryItem,
      });
    } else {
      await this.appointmentRepo.updateStatus(appointmentId, "cancelled");
    }


    const populated = await this.appointmentRepo.findById(appointmentId, true);

    try {
      if (this.notificationService) {
        await this.notificationService.sendAppointmentCancellation(
          populated || appointment,
          previousStatus,
          reason,
          cancelledByRole,
        );
      } else {
        const patientId = (appointment.patient as any)?._id || appointment.patient;
        const apptDateStr = appointment.appointmentDate
          ? new Date(appointment.appointmentDate).toLocaleDateString()
          : "Scheduled date";

        await this.notificationRepo.create({
          recipient: patientId,
          type: "cancellation",
          title: cancelledByRole === "admin" ? "Appointment Cancelled by Administrator" : "Appointment Cancelled",
          message: `Your appointment on ${apptDateStr} at ${appointment.timeSlot} was cancelled.${reason ? ` Reason: ${reason}` : ""}`,
          appointment: appointment._id,
        });

        if (cancelledByRole === "admin") {
          const doctorDoc = await this.doctorRepo.findById(appointment.doctor, true);
          if (doctorDoc?.user) {
            await this.notificationRepo.create({
              recipient: (doctorDoc.user as any)._id || doctorDoc.user,
              type: "cancellation",
              title: "Appointment Cancelled by Administrator",
              message: `An administrator has cancelled the appointment on ${apptDateStr} at ${appointment.timeSlot}.${reason ? ` Reason: ${reason}` : ""}`,
              appointment: appointment._id,
            });
          }
        }
      }
    } catch (notifErr) {
      console.warn("Failed to create cancellation notification:", notifErr);
    }

    return populated;
  }

  async adminRescheduleAppointment(data: {
    adminUserId: string;
    appointmentId: string;
    newDate: string | Date;
    newTimeSlot: string;
    reason?: string;
  }) {
    const { adminUserId, appointmentId, newDate, newTimeSlot, reason } = data;

    if (!newDate || !newTimeSlot) {
      throw new BadRequestError("New date and time slot are required for rescheduling.");
    }

    const appointment = await this.appointmentRepo.findById(appointmentId, false);
    if (!appointment) {
      throw new NotFoundError("Appointment not found.");
    }

    if (appointment.status === "completed" || appointment.status === "cancelled") {
      throw new BadRequestError(`Cannot reschedule an appointment that is already ${appointment.status}.`);
    }

    const cleanTimeSlot = newTimeSlot.trim();
    const doctorId = (appointment.doctor as any)?._id || appointment.doctor;

    const validation = await this.validateDoctorSlotAvailability({
      doctorId,
      date: newDate,
      timeSlot: cleanTimeSlot,
      excludeAppointmentId: appointment._id,
    });

    if (!validation.available) {
      throw new BadRequestError(validation.message || "The requested slot is not available.");
    }

    const proposedDateObj = new Date(newDate);
    const previousDate = appointment.appointmentDate;
    const previousTimeSlot = appointment.timeSlot;

    const rescheduleRequestData = {
      status: "accepted",
      approvalStatus: "not_required",
      proposedDate: proposedDateObj,
      proposedTimeSlot: cleanTimeSlot,
      reason: reason?.trim() || "Administrator rescheduled this consultation",
      requestedBy: "admin",
      requestedByRole: "admin",
      requestedByUser: adminUserId,
      requestedAt: new Date(),
      respondedAt: new Date(),
    };

    const actionHistoryItem = {
      action: "rescheduled_by_admin",
      initiatedBy: adminUserId,
      initiatedByRole: "admin",
      approvalStatus: "not_required",
      timestamp: new Date(),
      details: {
        previousDate,
        previousTimeSlot,
        newDate: proposedDateObj,
        newTimeSlot: cleanTimeSlot,
        reason: reason?.trim(),
      },
    };

    await this.appointmentRepo.adminReschedule(
      appointment._id,
      proposedDateObj,
      cleanTimeSlot,
      rescheduleRequestData,
      actionHistoryItem,
    );

    const populated = await this.appointmentRepo.findById(appointment._id, true);

    try {
      if (this.notificationService) {
        await this.notificationService.sendAppointmentRescheduleConfirmed(
          populated || appointment,
          previousDate,
          previousTimeSlot,
        );
      } else {
        const patientUserId = (appointment.patient as any)?._id || appointment.patient;
        const formattedDate = proposedDateObj.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });

        await this.notificationRepo.create({
          recipient: patientUserId,
          type: "rescheduled",
          title: "Appointment Rescheduled by Administrator",
          message: `An administrator has rescheduled your appointment to ${formattedDate} at ${cleanTimeSlot}.${reason ? ` Reason: ${reason.trim()}` : ""}`,
          appointment: appointment._id,
        });

        const doctorDoc = await this.doctorRepo.findById(doctorId, true);
        if (doctorDoc?.user) {
          await this.notificationRepo.create({
            recipient: (doctorDoc.user as any)._id || doctorDoc.user,
            type: "rescheduled",
            title: "Appointment Rescheduled by Administrator",
            message: `An administrator has rescheduled an appointment to ${formattedDate} at ${cleanTimeSlot}.${reason ? ` Reason: ${reason.trim()}` : ""}`,
            appointment: appointment._id,
          });
        }
      }
    } catch (nErr) {
      console.warn("Failed to notify parties of admin reschedule:", nErr);
    }

    return populated;
  }

  async adminCancelAppointment(data: {
    adminUserId: string;
    appointmentId: string;
    reason?: string;
  }) {
    return this.cancelAppointment({
      appointmentId: data.appointmentId,
      reason: data.reason,
      cancelledByRole: "admin",
      cancelledByUserId: data.adminUserId,
    });
  }
}

