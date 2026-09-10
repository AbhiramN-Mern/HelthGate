import type { Types } from "mongoose";
import { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { IHospitalDoctorRepository } from "../repositories/interfaces/IHospitalDoctorRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { BadRequestError, ForbiddenError, NotFoundError } from "../core/errors/AppError.js";

export const MAX_BOOKING_DAYS_AHEAD = Number(process.env.MAX_BOOKING_DAYS_AHEAD) || 90;

export class AppointmentService {
  constructor(
    private appointmentRepo: IAppointmentRepository,
    private doctorRepo: IDoctorRepository,
    private hospitalDoctorRepo: IHospitalDoctorRepository,
    private notificationRepo: INotificationRepository,
    private userRepo: IUserRepository,
  ) {}

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

  async getMyAppointments(patientUserId: string) {
    return this.appointmentRepo.find(
      {
        patient: patientUserId,
        status: { $in: ["scheduled", "confirmed"] },
      },
      true,
      { appointmentDate: 1 },
    );
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
      status: "scheduled",
    });

    const populated = await this.appointmentRepo.findById(appointment._id, true);

    try {
      if (doctorDoc?.user) {
        const patientUser = await this.userRepo.findById(patientUserId);
        await this.notificationRepo.create({
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

    await this.appointmentRepo.updateRescheduleRequest(appointment._id, {
      status: "pending",
      proposedDate: proposedDateObj,
      proposedTimeSlot: cleanTimeSlot,
      reason: reason?.trim() || "Doctor requested a schedule adjustment",
      requestedBy: "doctor",
      requestedAt: new Date(),
      respondedAt: null,
    });

    const populated = await this.appointmentRepo.findById(appointment._id, true);

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

      await this.notificationRepo.create({
        recipient: patientUserId,
        type: "reschedule_request",
        title: "Appointment Reschedule Requested",
        message: `${doctorName} has requested to reschedule your appointment from ${originalDateStr} at ${appointment.timeSlot} to ${formattedProposedDate} at ${cleanTimeSlot}.${reason ? ` Reason: ${reason.trim()}` : ""}`,
        appointment: appointment._id,
      });
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

      await this.appointmentRepo.applyReschedule(
        appointment._id,
        appointment.rescheduleRequest.proposedDate,
        appointment.rescheduleRequest.proposedTimeSlot,
        {
          ...appointment.rescheduleRequest,
          status: "accepted",
          respondedAt: new Date(),
        },
      );

      try {
        if (doctorDoc?.user) {
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

      const populated = await this.appointmentRepo.findById(appointment._id, true);
      return {
        message: "Reschedule accepted. Your appointment has been successfully updated to the new date and time.",
        appointment: populated,
      };
    } else {
      await this.appointmentRepo.updateRescheduleRequest(appointment._id, {
        ...appointment.rescheduleRequest,
        status: "declined",
        respondedAt: new Date(),
      });

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

      return {
        doctor,
        date: dateOnly,
        bookedSlots: Array.from(bookedSet),
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
}
