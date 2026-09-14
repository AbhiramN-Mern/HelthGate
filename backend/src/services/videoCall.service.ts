import crypto from "node:crypto";
import type { Types } from "mongoose";
import type { IAppointmentRepository } from "../repositories/interfaces/IAppointmentRepository.js";
import type { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import type { ICallSessionRepository } from "../repositories/interfaces/ICallSessionRepository.js";
import { MongoCallSessionRepository } from "../repositories/implementations/MongoCallSessionRepository.js";
import type { NotificationService } from "./notification.service.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from "../core/errors/AppError.js";

export interface IceServerConfig {
  urls: string | string[];
  username?: string;
  credential?: string;
}

export class VideoCallService {
  private socketBroadcaster?: (event: string, roomOrUser: string, data: any) => void;
  private callSessionRepo?: ICallSessionRepository;
  private notificationService?: NotificationService;

  constructor(
    private appointmentRepo: IAppointmentRepository,
    callSessionRepo?: ICallSessionRepository,
    notificationService?: NotificationService,
    private doctorRepo?: IDoctorRepository,
  ) {
    this.callSessionRepo = callSessionRepo;
    this.notificationService = notificationService;
  }

  /**
   * Set socket broadcaster hook from server/socket layer
   */
  public setSocketBroadcaster(
    broadcaster: (event: string, roomOrUser: string, data: any) => void,
  ) {
    this.socketBroadcaster = broadcaster;
  }

  /**
   * Retrieve ICE Server configuration:
   * First attempts to query Metered credentials API using METERED_DOMAIN & METERED_API_KEY.
   * If unavailable or fails, falls back safely to static TURN/STUN environment variables.
   */
  public async getIceServers(): Promise<IceServerConfig[]> {
    const stunUrl =
      process.env.STUN_SERVER_URL || "stun:stun.l.google.com:19302";

    // Fallback static ICE server list
    const fallbackIceServers: IceServerConfig[] = [
      {
        urls: [stunUrl, "stun:stun1.l.google.com:19302"],
      },
    ];

    if (process.env.TURN_SERVER_URL) {
      const rawTurn = process.env.TURN_SERVER_URL.trim();
      const turnUrls: string[] = rawTurn.includes(",")
        ? rawTurn.split(",").map((s) => s.trim())
        : [
            rawTurn,
            rawTurn.includes("relay.metered.ca")
              ? "turn:global.relay.metered.ca:443?transport=tcp"
              : "",
          ].filter(Boolean);

      const turnConfig: IceServerConfig = {
        urls: turnUrls.length === 1 ? turnUrls[0] : turnUrls,
      };

      if (process.env.TURN_USERNAME) {
        turnConfig.username = process.env.TURN_USERNAME;
      }
      if (process.env.TURN_PASSWORD) {
        turnConfig.credential = process.env.TURN_PASSWORD;
      }
      fallbackIceServers.push(turnConfig);
    }

    // Attempt dynamic Metered API credentials if METERED_API_KEY is configured
    const meteredDomain = process.env.METERED_DOMAIN || "helthgate.metered.live";
    const meteredApiKey = process.env.METERED_API_KEY?.trim();

    if (meteredApiKey && meteredApiKey !== "<PUT_REAL_METERED_API_KEY_HERE>") {
      try {
        const response = await fetch(
          `https://${meteredDomain}/api/v1/turn/credentials?apiKey=${meteredApiKey}`,
          { signal: AbortSignal.timeout(3000) },
        );

        if (response.ok) {
          const meteredServers = await response.json();
          if (Array.isArray(meteredServers) && meteredServers.length > 0) {
            console.log(
              `[VideoCall] Successfully fetched ${meteredServers.length} dynamic ICE servers from Metered.`,
            );
            return meteredServers;
          }
        }
      } catch (err: any) {
        console.warn(
          "[VideoCall] Metered API fetch unsuccessful, using fallback static TURN/STUN configuration:",
          err.message,
        );
      }
    }

    return fallbackIceServers;
  }

  /**
   * Helper: extract doctor user ID and patient user ID from appointment
   */
  private async resolveAppointmentParticipants(appointment: any): Promise<{
    patientUserId: string;
    patientName: string;
    doctorUserId: string;
    doctorName: string;
    specialization: string;
  }> {
    // 1. Patient User
    let patientUserId = "";
    let patientName = "Patient";
    if (appointment.patient && typeof appointment.patient === "object") {
      patientUserId = String(appointment.patient._id || appointment.patient.id);
      patientName = appointment.patient.name || patientName;
    } else if (appointment.patient) {
      patientUserId = String(appointment.patient);
    }

    // 2. Doctor User
    let doctorUserId = "";
    let doctorName = "Attending Physician";
    let specialization = "General Medicine";

    const docObj = appointment.doctor;
    if (docObj && typeof docObj === "object") {
      specialization = docObj.specialization || specialization;
      if (docObj.user && typeof docObj.user === "object") {
        doctorUserId = String(docObj.user._id || docObj.user.id);
        doctorName = docObj.user.name || doctorName;
      } else if (docObj.user) {
        doctorUserId = String(docObj.user);
      }
    } else if (docObj) {
      if (this.doctorRepo) {
        try {
          const docRecord = await this.doctorRepo.findById(docObj, true);
          if (docRecord) {
            specialization = docRecord.specialization || specialization;
            if (docRecord.user && typeof docRecord.user === "object") {
              doctorUserId = String(docRecord.user._id || docRecord.user.id);
              doctorName = docRecord.user.name || doctorName;
            } else if (docRecord.user) {
              doctorUserId = String(docRecord.user);
            }
          }
        } catch (e) {
          console.warn("[VideoCall] Could not resolve doctor record:", e);
        }
      }
    }

    return {
      patientUserId,
      patientName,
      doctorUserId,
      doctorName,
      specialization,
    };
  }

  /**
   * Doctor Starts Consultation Call
   * CRITICAL REQUIREMENT: DO NOT block by appointment start time.
   * Doctor can start any eligible appointment at any time.
   */
  async startConsultationCall({
    appointmentId,
    doctorUserId,
  }: {
    appointmentId: string | Types.ObjectId;
    doctorUserId: string;
  }) {
    if (!appointmentId) {
      throw new BadRequestError("Appointment ID is required");
    }

    console.log(
      `[VideoCall] Doctor ${doctorUserId} starting video consultation for appointment ${appointmentId}`,
    );

    const appointment = await this.appointmentRepo.findById(appointmentId, true);
    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const {
      patientUserId,
      patientName,
      doctorUserId: resolvedDoctorUserId,
      doctorName,
      specialization,
    } = await this.resolveAppointmentParticipants(appointment);

    // Verify authenticated user is the assigned doctor
    if (!resolvedDoctorUserId || resolvedDoctorUserId !== doctorUserId.toString()) {
      throw new ForbiddenError(
        "Unauthorized: Only the assigned doctor can start this video consultation.",
      );
    }

    if (!patientUserId) {
      throw new BadRequestError(
        "Appointment does not have an assigned patient.",
      );
    }

    // Status Eligibility Check
    const normalizedStatus = (appointment.status || "").toLowerCase();
    if (normalizedStatus === "cancelled") {
      throw new BadRequestError(
        "This appointment has been cancelled and cannot be started.",
      );
    }

    if (
      normalizedStatus === "pending_payment" ||
      normalizedStatus === "pending"
    ) {
      throw new BadRequestError(
        "Appointment payment is pending. Consultations can only be started for confirmed appointments.",
      );
    }

    // Notice: We intentionally DO NOT check appointment start time or date here!
    // Doctors are authorized to initiate the call at any time for eligible appointments.

    // 5. Prevent Duplicate Active Sessions: Check for existing ringing/active session
    let session = this.callSessionRepo
      ? await this.callSessionRepo.findActiveByAppointment(appointment._id)
      : null;

    if (!session) {
      const secureRoomId = `room-${crypto.randomUUID()}`;
      if (this.callSessionRepo) {
        session = await this.callSessionRepo.create({
          appointmentId: appointment._id,
          doctorId: doctorUserId,
          patientId: patientUserId,
          roomId: secureRoomId,
          status: "ringing",
          initiatedBy: doctorUserId,
          startedAt: null,
        });

        console.log(
          `[VideoCall] Created new CallSession ${session._id} with roomId: ${session.roomId}`,
        );
      } else {
        session = {
          _id: appointment._id,
          appointmentId: appointment._id,
          doctorId: doctorUserId,
          patientId: patientUserId,
          roomId: secureRoomId,
          status: "ringing",
          initiatedBy: doctorUserId,
          startedAt: null,
        } as any;
      }
    } else {
      console.log(
        `[VideoCall] Reusing existing active CallSession ${session._id} (status: ${session.status})`,
      );
    }

    const activeSession = session!;

    // 6. Persistent Notification for Patient (Database)
    if (this.notificationService) {
      await this.notificationService.sendVideoCallNotification({
        patientUserId,
        appointmentId: appointment._id,
        callSessionId: activeSession._id,
        doctorName,
      });
    }

    // 7. Real-Time Socket Notification to Patient
    if (this.socketBroadcaster) {
      this.socketBroadcaster("video-call-incoming", `user:${patientUserId}`, {
        callSessionId: activeSession._id.toString(),
        appointmentId: appointment._id.toString(),
        roomId: activeSession.roomId,
        doctorName,
        specialization,
        timeSlot: appointment.timeSlot,
        title: "Video Consultation Started",
        message: `Dr. ${doctorName.replace(/^Dr\.?\s*/i, "")} has started a video consultation.`,
      });
    }

    const iceServers = await this.getIceServers();

    return {
      callSession: {
        id: activeSession._id.toString(),
        appointmentId: appointment._id.toString(),
        status: activeSession.status,
        roomId: activeSession.roomId,
      },
      appointmentId: appointment._id.toString(),
      roomId: activeSession.roomId,
      doctorName,
      patientName,
      specialization,
      userRole: "doctor" as const,
      iceServers,
    };
  }

  /**
   * Patient Joins Consultation Call
   */
  async joinConsultationCall({
    callSessionId,
    patientUserId,
  }: {
    callSessionId: string | Types.ObjectId;
    patientUserId: string;
  }) {
    if (!callSessionId) {
      throw new BadRequestError("Call session ID is required");
    }

    let session = this.callSessionRepo
      ? await this.callSessionRepo.findById(callSessionId)
      : null;
    // If not found by session ID, attempt to look up active session by appointment ID
    if (!session && this.callSessionRepo) {
      session = await this.callSessionRepo.findActiveByAppointment(callSessionId);
    }

    if (!session) {
      const appt = await this.appointmentRepo.findById(callSessionId, true);
      if (appt) {
        session = {
          _id: appt._id,
          appointmentId: appt._id,
          doctorId: (appt.doctor as any)?.user?._id || (appt.doctor as any)?.user,
          patientId: appt.patient?._id || appt.patient,
          roomId: appt.videoCall?.roomId || `room-${crypto.randomUUID()}`,
          status: "active",
          initiatedBy: (appt.doctor as any)?.user?._id || (appt.doctor as any)?.user,
          startedAt: new Date(),
        } as any;
      }
    }

    if (!session) {
      throw new NotFoundError("Video consultation session not found.");
    }

    // Verify patient authorization
    if (session.patientId.toString() !== patientUserId.toString()) {
      throw new ForbiddenError(
        "Unauthorized: You are not authorized to join this consultation.",
      );
    }

    if (session.status === "ended") {
      throw new BadRequestError("This video consultation has ended.");
    }

    if (session.status === "cancelled" || session.status === "failed") {
      throw new BadRequestError(
        `This video consultation is no longer available (${session.status}).`,
      );
    }

    // If session was ringing, mark as active when patient joins
    if (session.status === "ringing") {
      const now = new Date();
      if (this.callSessionRepo) {
        session = await this.callSessionRepo.updateStatus(session._id, "active", {
          startedAt: session.startedAt || now,
        });
      }
    }

    const appointment = await this.appointmentRepo.findById(
      session!.appointmentId,
      true,
    );

    const { doctorName, patientName, specialization } =
      appointment
        ? await this.resolveAppointmentParticipants(appointment)
        : {
            doctorName: "Doctor",
            patientName: "Patient",
            specialization: "Specialist",
          };

    const iceServers = await this.getIceServers();

    return {
      callSession: {
        id: session!._id.toString(),
        appointmentId: session!.appointmentId.toString(),
        status: session!.status,
        roomId: session!.roomId,
      },
      appointmentId: session!.appointmentId.toString(),
      roomId: session!.roomId,
      doctorName,
      patientName,
      specialization,
      userRole: "patient" as const,
      iceServers,
    };
  }

  /**
   * Validate Access for either Doctor or Patient by Session ID or Appointment ID
   */
  async validateCallAccess({
    sessionIdOrApptId,
    appointmentId,
    userId,
    bypassTimeCheck,
  }: {
    sessionIdOrApptId?: string | Types.ObjectId;
    appointmentId?: string | Types.ObjectId;
    userId: string;
    bypassTimeCheck?: boolean;
  }) {
    const targetId = String(sessionIdOrApptId || appointmentId || "");
    if (!targetId) {
      throw new BadRequestError("Session or Appointment ID is required");
    }

    let appointment = await this.appointmentRepo.findById(targetId, true);
    let session: any = null;

    if (!appointment && this.callSessionRepo) {
      session = await this.callSessionRepo.findById(targetId);
      if (session) {
        appointment = await this.appointmentRepo.findById(
          session.appointmentId,
          true,
        );
      }
    }

    if (!appointment) {
      throw new NotFoundError("Appointment not found");
    }

    const {
      patientUserId,
      patientName,
      doctorUserId,
      doctorName,
      specialization,
    } = await this.resolveAppointmentParticipants(appointment);

    const isDoctor = doctorUserId === userId.toString();
    const isPatient = patientUserId === userId.toString();

    if (!isDoctor && !isPatient) {
      throw new ForbiddenError(
        "Unauthorized: You are not an authorized participant in this consultation.",
      );
    }

    const userRole: "doctor" | "patient" = isDoctor ? "doctor" : "patient";

    // Status validation
    const normalizedStatus = (appointment.status || "").toLowerCase();
    if (normalizedStatus === "cancelled") {
      throw new BadRequestError(
        "This appointment has been cancelled and cannot be joined.",
      );
    }

    if (
      normalizedStatus === "pending_payment" ||
      normalizedStatus === "pending"
    ) {
      throw new BadRequestError(
        "Appointment payment is pending. Consultations are available only for confirmed appointments.",
      );
    }

    if (this.callSessionRepo && !session) {
      session = await this.callSessionRepo.findActiveByAppointment(appointment._id);
    }

    // Ensure session / roomId exists
    let roomId = session?.roomId || appointment.videoCall?.roomId;
    if (!roomId) {
      roomId = `room-${crypto.randomUUID()}`;
      if (this.callSessionRepo) {
        session = await this.callSessionRepo.create({
          appointmentId: appointment._id,
          doctorId: doctorUserId,
          patientId: patientUserId,
          roomId,
          status: isDoctor ? "ringing" : "active",
          initiatedBy: userId,
        });
      } else {
        await this.appointmentRepo.findByIdAndUpdate(appointment._id, {
          "videoCall.enabled": true,
          "videoCall.roomId": roomId,
        });
      }
    }

    if (session?.status === "ended") {
      throw new BadRequestError("This video consultation has already ended and was marked completed.");
    }

    const iceServers = await this.getIceServers();

    return {
      callSession: {
        id: session?._id ? session._id.toString() : appointment._id.toString(),
        appointmentId: appointment._id.toString(),
        status: session?.status || "ringing",
        roomId,
      },
      appointmentId: appointment._id.toString(),
      roomId,
      userRole,
      userName: isPatient ? patientName : doctorName,
      remoteUserName: isPatient ? doctorName : patientName,
      doctorName,
      patientName,
      specialization,
      timeSlot: appointment.timeSlot,
      appointmentDate: appointment.appointmentDate,
      status: appointment.status,
      iceServers,
    };
  }

  /**
   * Helper to mark call started
   */
  async recordCallStart(appointmentId: string | Types.ObjectId) {
    if (this.callSessionRepo) {
      const session = await this.callSessionRepo.findActiveByAppointment(appointmentId);
      if (session) {
        if (!session.startedAt) {
          return this.callSessionRepo.updateStatus(session._id, "active", {
            startedAt: new Date(),
          });
        }
        return session;
      }
    }

    const appt = await this.appointmentRepo.findById(appointmentId, false);
    if (!appt) return null;
    return this.appointmentRepo.findByIdAndUpdate(appointmentId, {
      "videoCall.startedAt": new Date(),
      "videoCall.enabled": true,
    });
  }

  /**
   * End Consultation Call
   */
  async recordCallEnd({
    callSessionIdOrApptId,
    appointmentId,
    endedByUserId,
    reason = "Consultation concluded",
  }: {
    callSessionIdOrApptId?: string | Types.ObjectId;
    appointmentId?: string | Types.ObjectId;
    endedByUserId?: string;
    reason?: string;
  }) {
    const targetId = String(callSessionIdOrApptId || appointmentId || "");
    let session = this.callSessionRepo
      ? await this.callSessionRepo.findById(targetId)
      : null;

    if (!session && this.callSessionRepo) {
      session = await this.callSessionRepo.findActiveByAppointment(targetId);
    }

    const now = new Date();

    if (session && this.callSessionRepo) {
      const startedAt = session.startedAt ? new Date(session.startedAt) : now;
      const durationSeconds = Math.max(
        0,
        Math.round((now.getTime() - startedAt.getTime()) / 1000),
      );

      const updatedSession = await this.callSessionRepo.updateStatus(
        session._id,
        "ended",
        {
          endedAt: now,
          duration: durationSeconds,
        },
      );

      const appointment = await this.appointmentRepo.findById(
        session.appointmentId,
        true,
      );

      if (appointment && endedByUserId) {
        const { doctorUserId } = await this.resolveAppointmentParticipants(
          appointment,
        );
        if (doctorUserId === endedByUserId.toString()) {
          await this.appointmentRepo.findByIdAndUpdate(appointment._id, {
            status: "completed",
          });
        }
      }

      return {
        success: true,
        callSessionId: session._id.toString(),
        duration: durationSeconds,
        startedAt,
        endedAt: now,
        session: updatedSession,
        reason,
      };
    }

    // Fallback for tests without callSessionRepo
    const appt = await this.appointmentRepo.findById(targetId, true);
    if (!appt) {
      throw new NotFoundError("Appointment not found");
    }

    const startedAt = appt.videoCall?.startedAt ? new Date(appt.videoCall.startedAt) : now;
    const durationSeconds = Math.max(
      0,
      Math.round((now.getTime() - startedAt.getTime()) / 1000),
    );

    const updateData: Record<string, unknown> = {
      "videoCall.endedAt": now,
      "videoCall.duration": durationSeconds,
    };

    if (endedByUserId) {
      const { doctorUserId } = await this.resolveAppointmentParticipants(appt);
      if (doctorUserId === endedByUserId.toString()) {
        updateData.status = "completed";
      }
    }

    const updated = await this.appointmentRepo.findByIdAndUpdate(appt._id, updateData);

    return {
      success: true,
      duration: durationSeconds,
      startedAt,
      endedAt: now,
      appointment: updated,
      reason,
    };
  }
}
