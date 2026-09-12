import type { Types } from "mongoose";
import type { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import type { IEmailService } from "../infrastructure/email/IEmailService.js";
import type { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import {
  renderAppointmentConfirmationEmail,
  renderAppointmentCancellationEmail,
  renderAppointmentStatusUpdateEmail,
  renderAppointmentRescheduleRequestEmail,
  renderAppointmentRescheduleConfirmedEmail,
  type AppointmentEmailData,
} from "../utils/emailTemplates.js";

export class NotificationService {
  constructor(
    private notificationRepo: INotificationRepository,
    private emailService: IEmailService,
    private userRepo?: IUserRepository,
    private doctorRepo?: IDoctorRepository,
  ) {}

  /**
   * Helper to safely extract full appointment details for email generation
   */
  private async resolveAppointmentDetails(appointment: any): Promise<{
    patientId: string;
    patientName: string;
    patientEmail: string;
    doctorId: string;
    doctorUserId?: string;
    doctorName: string;
    doctorSpecialization?: string;
    hospitalName?: string;
    department?: string;
    appointmentDateStr: string;
    appointmentTimeStr: string;
    appointmentIdStr: string;
    appointmentType?: string;
    reason?: string;
  }> {
    const appointmentIdStr = String(appointment._id || appointment.id || "");

    // 1. Resolve Patient
    let patientId = "";
    let patientName = "Valued Patient";
    let patientEmail = "";

    if (appointment.patient && typeof appointment.patient === "object" && appointment.patient.email) {
      patientId = String(appointment.patient._id || appointment.patient.id);
      patientName = appointment.patient.name || patientName;
      patientEmail = appointment.patient.email || "";
    } else {
      patientId = String(appointment.patient?._id || appointment.patient || "");
      if (patientId && this.userRepo) {
        try {
          const userDoc = await this.userRepo.findById(patientId);
          if (userDoc) {
            patientName = userDoc.name || patientName;
            patientEmail = userDoc.email || "";
          }
        } catch (err) {
          console.warn("[NotificationService] Could not resolve patient user:", err);
        }
      }
    }

    // 2. Resolve Doctor
    let doctorId = "";
    let doctorUserId = "";
    let doctorName = "Healthcare Specialist";
    let doctorSpecialization = "";

    const docObj = appointment.doctor;
    if (docObj && typeof docObj === "object") {
      doctorId = String(docObj._id || docObj.id || "");
      doctorSpecialization = docObj.specialization || "";
      if (docObj.user && typeof docObj.user === "object") {
        doctorUserId = String(docObj.user._id || docObj.user.id || "");
        doctorName = docObj.user.name || doctorName;
      } else if (docObj.user) {
        doctorUserId = String(docObj.user);
      }
    } else if (docObj) {
      doctorId = String(docObj);
    }

    // If doctor user name wasn't resolved directly, check doctorRepo/userRepo
    if (this.doctorRepo && doctorId && (!doctorName || doctorName === "Healthcare Specialist")) {
      try {
        const docDoc = await this.doctorRepo.findById(doctorId, true);
        if (docDoc) {
          doctorSpecialization = docDoc.specialization || doctorSpecialization;
          if (docDoc.user && typeof docDoc.user === "object") {
            doctorUserId = String(docDoc.user._id || docDoc.user.id || "");
            doctorName = docDoc.user.name || doctorName;
          } else if (docDoc.user && this.userRepo) {
            doctorUserId = String(docDoc.user);
            const userDoc = await this.userRepo.findById(doctorUserId);
            if (userDoc) doctorName = userDoc.name || doctorName;
          }
        }
      } catch (err) {
        console.warn("[NotificationService] Could not resolve doctor details:", err);
      }
    }

    // 3. Hospital / Facility
    let hospitalName = "";
    if (appointment.hospital && typeof appointment.hospital === "object") {
      hospitalName = appointment.hospital.name || "";
    }

    // 4. Date & Time formatting
    let appointmentDateStr = "Scheduled Date";
    if (appointment.appointmentDate) {
      try {
        appointmentDateStr = new Date(appointment.appointmentDate).toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      } catch {
        appointmentDateStr = String(appointment.appointmentDate);
      }
    }

    const appointmentTimeStr = appointment.timeSlot || "Scheduled Slot";

    return {
      patientId,
      patientName,
      patientEmail,
      doctorId,
      doctorUserId,
      doctorName,
      doctorSpecialization,
      hospitalName,
      department: appointment.department || "",
      appointmentDateStr,
      appointmentTimeStr,
      appointmentIdStr,
      appointmentType: appointment.type || "Consultation",
      reason: appointment.reason || "",
    };
  }

  /**
   * 1. Send Appointment Confirmation Notification (In-App + Email)
   */
  async sendAppointmentConfirmation(appointment: any): Promise<{
    emailResult?: { success: boolean; messageId?: string; error?: string };
    inAppSuccess: boolean;
  }> {
    let inAppSuccess = false;
    let emailResult: { success: boolean; messageId?: string; error?: string } | undefined;

    try {
      const details = await this.resolveAppointmentDetails(appointment);

      // In-App Notification to Patient
      try {
        if (details.patientId) {
          await this.notificationRepo.create({
            recipient: details.patientId,
            type: "appointment_confirmed",
            title: "Appointment Confirmed",
            message: `Your appointment with Dr. ${details.doctorName} on ${details.appointmentDateStr} at ${details.appointmentTimeStr} is confirmed.`,
            appointment: details.appointmentIdStr,
          });
        }

        // In-App Notification to Doctor (if doctor user available)
        if (details.doctorUserId) {
          await this.notificationRepo.create({
            recipient: details.doctorUserId,
            type: "new_appointment",
            title: "New Confirmed Appointment",
            message: `Patient ${details.patientName} has confirmed an appointment on ${details.appointmentDateStr} at ${details.appointmentTimeStr}.`,
            appointment: details.appointmentIdStr,
          });
        }
        inAppSuccess = true;
      } catch (inAppErr) {
        console.warn("[NotificationService] Failed to create confirmation in-app notification:", inAppErr);
      }

      // Email Notification to Patient
      if (details.patientEmail) {
        try {
          const emailData: AppointmentEmailData = {
            patientName: details.patientName,
            patientEmail: details.patientEmail,
            doctorName: details.doctorName,
            doctorSpecialization: details.doctorSpecialization,
            hospitalName: details.hospitalName,
            department: details.department,
            appointmentDate: details.appointmentDateStr,
            appointmentTime: details.appointmentTimeStr,
            appointmentId: details.appointmentIdStr,
            appointmentType: details.appointmentType,
            reason: details.reason,
            newStatus: "confirmed",
          };

          const rendered = renderAppointmentConfirmationEmail(emailData);
          emailResult = await this.emailService.sendEmail({
            to: details.patientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
        } catch (emailErr: any) {
          console.error("[NotificationService] Error sending confirmation email:", emailErr);
          emailResult = { success: false, error: emailErr.message || "Email send failure" };
        }
      } else {
        console.warn(`[NotificationService] No email address for patient ID ${details.patientId}. Skipping email.`);
        emailResult = { success: false, error: "Patient email not available" };
      }
    } catch (err) {
      console.error("[NotificationService] Unexpected error in sendAppointmentConfirmation:", err);
    }

    return { inAppSuccess, emailResult };
  }

  /**
   * 2. Send Appointment Cancellation Notification (In-App + Email)
   */
  async sendAppointmentCancellation(
    appointment: any,
    previousStatus?: string,
    reason?: string,
    cancelledBy?: "doctor" | "patient" | "admin",
  ): Promise<{
    emailResult?: { success: boolean; messageId?: string; error?: string };
    inAppSuccess: boolean;
    skippedDuplicate?: boolean;
  }> {
    // Avoid sending duplicate cancellation notification if already cancelled
    if (previousStatus && previousStatus.toLowerCase() === "cancelled") {
      console.log(`[NotificationService] Appointment ${appointment._id} is already cancelled. Skipping duplicate cancellation notification.`);
      return { inAppSuccess: true, skippedDuplicate: true };
    }

    let inAppSuccess = false;
    let emailResult: { success: boolean; messageId?: string; error?: string } | undefined;

    try {
      const details = await this.resolveAppointmentDetails(appointment);
      const cancellationReason = reason || appointment.cancellationReason || "Schedule conflict or patient/provider request";

      // In-App Notification to Patient
      try {
        if (details.patientId) {
          await this.notificationRepo.create({
            recipient: details.patientId,
            type: "cancellation",
            title: "Appointment Cancelled",
            message: `Your appointment with Dr. ${details.doctorName} on ${details.appointmentDateStr} at ${details.appointmentTimeStr} was cancelled.${reason ? ` Reason: ${reason}` : ""}`,
            appointment: details.appointmentIdStr,
          });
        }

        // In-App Notification to Doctor (if doctor user available and patient cancelled)
        if (details.doctorUserId && cancelledBy !== "doctor") {
          await this.notificationRepo.create({
            recipient: details.doctorUserId,
            type: "cancellation",
            title: "Appointment Cancelled by Patient",
            message: `Patient ${details.patientName}'s appointment on ${details.appointmentDateStr} at ${details.appointmentTimeStr} was cancelled.`,
            appointment: details.appointmentIdStr,
          });
        }
        inAppSuccess = true;
      } catch (inAppErr) {
        console.warn("[NotificationService] Failed to create cancellation in-app notification:", inAppErr);
      }

      // Email Notification to Patient
      if (details.patientEmail) {
        try {
          const emailData: AppointmentEmailData = {
            patientName: details.patientName,
            patientEmail: details.patientEmail,
            doctorName: details.doctorName,
            doctorSpecialization: details.doctorSpecialization,
            hospitalName: details.hospitalName,
            department: details.department,
            appointmentDate: details.appointmentDateStr,
            appointmentTime: details.appointmentTimeStr,
            appointmentId: details.appointmentIdStr,
            appointmentType: details.appointmentType,
            cancellationReason,
            previousStatus: previousStatus || "scheduled",
            newStatus: "cancelled",
          };

          const rendered = renderAppointmentCancellationEmail(emailData);
          emailResult = await this.emailService.sendEmail({
            to: details.patientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
        } catch (emailErr: any) {
          console.error("[NotificationService] Error sending cancellation email:", emailErr);
          emailResult = { success: false, error: emailErr.message || "Email send failure" };
        }
      } else {
        console.warn(`[NotificationService] No email address for patient ID ${details.patientId}. Skipping email.`);
        emailResult = { success: false, error: "Patient email not available" };
      }
    } catch (err) {
      console.error("[NotificationService] Unexpected error in sendAppointmentCancellation:", err);
    }

    return { inAppSuccess, emailResult };
  }

  /**
   * 3. Send Appointment Status Update Notification (In-App + Email)
   * Avoids sending duplicate emails when status has not changed.
   */
  async sendAppointmentStatusUpdate(
    appointment: any,
    previousStatus: string,
    newStatus: string,
    reason?: string,
  ): Promise<{
    emailResult?: { success: boolean; messageId?: string; error?: string };
    inAppSuccess: boolean;
    skippedDuplicate?: boolean;
  }> {
    // 1. Guard against duplicate notifications when status hasn't actually changed
    if (
      previousStatus &&
      newStatus &&
      previousStatus.trim().toLowerCase() === newStatus.trim().toLowerCase()
    ) {
      console.log(
        `[NotificationService] Status unchanged (${previousStatus} === ${newStatus}). Skipping duplicate notification.`,
      );
      return { inAppSuccess: true, skippedDuplicate: true };
    }

    // 2. Delegate to cancellation notification if newStatus is 'cancelled'
    if (newStatus.trim().toLowerCase() === "cancelled") {
      return this.sendAppointmentCancellation(appointment, previousStatus, reason);
    }

    // 3. Delegate to confirmation notification if newStatus is 'confirmed' and was previously not confirmed
    if (
      newStatus.trim().toLowerCase() === "confirmed" &&
      previousStatus.trim().toLowerCase() !== "confirmed"
    ) {
      return this.sendAppointmentConfirmation(appointment);
    }

    let inAppSuccess = false;
    let emailResult: { success: boolean; messageId?: string; error?: string } | undefined;

    try {
      const details = await this.resolveAppointmentDetails(appointment);
      const formattedStatus = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);

      // In-App Notification to Patient
      try {
        if (details.patientId) {
          await this.notificationRepo.create({
            recipient: details.patientId,
            type: newStatus === "completed" ? "system" : "status_update",
            title: `Appointment ${formattedStatus}`,
            message: `Your appointment with Dr. ${details.doctorName} on ${details.appointmentDateStr} at ${details.appointmentTimeStr} was updated to "${formattedStatus}".`,
            appointment: details.appointmentIdStr,
          });
        }
        inAppSuccess = true;
      } catch (inAppErr) {
        console.warn("[NotificationService] Failed to create status update in-app notification:", inAppErr);
      }

      // Email Notification to Patient
      if (details.patientEmail) {
        try {
          const emailData: AppointmentEmailData = {
            patientName: details.patientName,
            patientEmail: details.patientEmail,
            doctorName: details.doctorName,
            doctorSpecialization: details.doctorSpecialization,
            hospitalName: details.hospitalName,
            department: details.department,
            appointmentDate: details.appointmentDateStr,
            appointmentTime: details.appointmentTimeStr,
            appointmentId: details.appointmentIdStr,
            appointmentType: details.appointmentType,
            previousStatus,
            newStatus,
            reason,
          };

          const rendered = renderAppointmentStatusUpdateEmail(emailData);
          emailResult = await this.emailService.sendEmail({
            to: details.patientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
        } catch (emailErr: any) {
          console.error("[NotificationService] Error sending status update email:", emailErr);
          emailResult = { success: false, error: emailErr.message || "Email send failure" };
        }
      } else {
        console.warn(`[NotificationService] No email address for patient ID ${details.patientId}. Skipping email.`);
        emailResult = { success: false, error: "Patient email not available" };
      }
    } catch (err) {
      console.error("[NotificationService] Unexpected error in sendAppointmentStatusUpdate:", err);
    }

    return { inAppSuccess, emailResult };
  }

  /**
   * 4. Send Appointment Reschedule Request Notification (In-App + Email)
   */
  async sendAppointmentRescheduleRequest(
    appointment: any,
    proposedDate: Date | string,
    proposedTimeSlot: string,
    reason?: string,
  ): Promise<{
    emailResult?: { success: boolean; messageId?: string; error?: string };
    inAppSuccess: boolean;
  }> {
    let inAppSuccess = false;
    let emailResult: { success: boolean; messageId?: string; error?: string } | undefined;

    try {
      const details = await this.resolveAppointmentDetails(appointment);

      const proposedDateStr = new Date(proposedDate).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });

      // In-App Notification to Patient
      try {
        if (details.patientId) {
          await this.notificationRepo.create({
            recipient: details.patientId,
            type: "reschedule_request",
            title: "Appointment Reschedule Requested",
            message: `Dr. ${details.doctorName} requested to reschedule your appointment to ${proposedDateStr} at ${proposedTimeSlot}.${reason ? ` Reason: ${reason}` : ""}`,
            appointment: details.appointmentIdStr,
          });
        }
        inAppSuccess = true;
      } catch (inAppErr) {
        console.warn("[NotificationService] Failed to create reschedule in-app notification:", inAppErr);
      }

      // Email Notification to Patient
      if (details.patientEmail) {
        try {
          const emailData: AppointmentEmailData = {
            patientName: details.patientName,
            patientEmail: details.patientEmail,
            doctorName: details.doctorName,
            doctorSpecialization: details.doctorSpecialization,
            hospitalName: details.hospitalName,
            department: details.department,
            appointmentDate: details.appointmentDateStr,
            appointmentTime: details.appointmentTimeStr,
            originalDate: details.appointmentDateStr,
            originalTime: details.appointmentTimeStr,
            proposedDate: proposedDateStr,
            proposedTime: proposedTimeSlot,
            rescheduleReason: reason || "Doctor schedule adjustment",
            appointmentId: details.appointmentIdStr,
            appointmentType: details.appointmentType,
            newStatus: "reschedule_pending",
          };

          const rendered = renderAppointmentRescheduleRequestEmail(emailData);
          emailResult = await this.emailService.sendEmail({
            to: details.patientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
        } catch (emailErr: any) {
          console.error("[NotificationService] Error sending reschedule request email:", emailErr);
          emailResult = { success: false, error: emailErr.message || "Email send failure" };
        }
      } else {
        console.warn(`[NotificationService] No email address for patient ID ${details.patientId}. Skipping email.`);
        emailResult = { success: false, error: "Patient email not available" };
      }
    } catch (err) {
      console.error("[NotificationService] Unexpected error in sendAppointmentRescheduleRequest:", err);
    }

    return { inAppSuccess, emailResult };
  }

  /**
   * 5. Send Appointment Reschedule Confirmed Notification (In-App + Email)
   */
  async sendAppointmentRescheduleConfirmed(
    appointment: any,
    previousDate?: Date | string,
    previousTimeSlot?: string,
  ): Promise<{
    emailResult?: { success: boolean; messageId?: string; error?: string };
    inAppSuccess: boolean;
  }> {
    let inAppSuccess = false;
    let emailResult: { success: boolean; messageId?: string; error?: string } | undefined;

    try {
      const details = await this.resolveAppointmentDetails(appointment);

      let prevDateStr: string | undefined;
      if (previousDate) {
        try {
          prevDateStr = new Date(previousDate).toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
          });
        } catch {
          prevDateStr = String(previousDate);
        }
      }

      // In-App Notification to Patient
      try {
        if (details.patientId) {
          await this.notificationRepo.create({
            recipient: details.patientId,
            type: "reschedule_response",
            title: "Rescheduled Appointment Confirmed",
            message: `Your appointment with Dr. ${details.doctorName} is confirmed for ${details.appointmentDateStr} at ${details.appointmentTimeStr}.`,
            appointment: details.appointmentIdStr,
          });
        }

        // In-App Notification to Doctor
        if (details.doctorUserId) {
          await this.notificationRepo.create({
            recipient: details.doctorUserId,
            type: "reschedule_response",
            title: "Reschedule Request Accepted",
            message: `Patient ${details.patientName} accepted the reschedule for ${details.appointmentDateStr} at ${details.appointmentTimeStr}.`,
            appointment: details.appointmentIdStr,
          });
        }
        inAppSuccess = true;
      } catch (inAppErr) {
        console.warn("[NotificationService] Failed to create reschedule confirmation in-app notification:", inAppErr);
      }

      // Email Notification to Patient
      if (details.patientEmail) {
        try {
          const emailData: AppointmentEmailData = {
            patientName: details.patientName,
            patientEmail: details.patientEmail,
            doctorName: details.doctorName,
            doctorSpecialization: details.doctorSpecialization,
            hospitalName: details.hospitalName,
            department: details.department,
            appointmentDate: details.appointmentDateStr,
            appointmentTime: details.appointmentTimeStr,
            originalDate: prevDateStr,
            originalTime: previousTimeSlot,
            appointmentId: details.appointmentIdStr,
            appointmentType: details.appointmentType,
            newStatus: "confirmed",
          };

          const rendered = renderAppointmentRescheduleConfirmedEmail(emailData);
          emailResult = await this.emailService.sendEmail({
            to: details.patientEmail,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
          });
        } catch (emailErr: any) {
          console.error("[NotificationService] Error sending reschedule confirmation email:", emailErr);
          emailResult = { success: false, error: emailErr.message || "Email send failure" };
        }
      } else {
        console.warn(`[NotificationService] No email address for patient ID ${details.patientId}. Skipping email.`);
        emailResult = { success: false, error: "Patient email not available" };
      }
    } catch (err) {
      console.error("[NotificationService] Unexpected error in sendAppointmentRescheduleConfirmed:", err);
    }

    return { inAppSuccess, emailResult };
  }
}
