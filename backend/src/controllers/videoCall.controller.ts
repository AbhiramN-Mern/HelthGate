import type { Response } from "express";
import type { AuthenticatedRequest } from "../types/auth.js";
import { videoCallService } from "../container.js";

/**
 * POST /api/video-calls/start
 * Doctor initiates video consultation for an eligible appointment at ANY time.
 */
export const startCall = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const { appointmentId } = req.body || {};
    if (!appointmentId) {
      return res.status(400).json({
        success: false,
        message: "Appointment ID is required to start a consultation.",
      });
    }
    

    const consultationData = await videoCallService.startConsultationCall({
      appointmentId,
      doctorUserId: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Video consultation session initialized successfully.",
      ...consultationData,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to start consultation session.",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * POST /api/video-calls/:callSessionId/join
 * Patient joins an active/ringing video consultation session.
 */
export const joinCall = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const callSessionId = String(req.params.callSessionId);
    const consultationData = await videoCallService.joinConsultationCall({
      callSessionId,
      patientUserId: userId,
    });

    return res.status(200).json({
      success: true,
      message: "Joined video consultation successfully.",
      ...consultationData,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || (statusCode === 403 ? "FORBIDDEN" : "ERROR"),
      message: error.message || "Failed to join consultation session.",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * GET /api/video-calls/:sessionIdOrApptId
 * Retrieve consultation session details & ICE server list for authorized participants.
 */
export const getCallDetails = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const sessionIdOrApptId = String(
      req.params.sessionIdOrApptId || req.params.appointmentId || "",
    );
    const sessionDetails = await videoCallService.validateCallAccess({
      sessionIdOrApptId,
      userId,
    });

    return res.status(200).json({
      success: true,
      ...sessionDetails,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: error.code || (statusCode === 403 ? "FORBIDDEN" : "ERROR"),
      message: error.message || "Failed to retrieve consultation details.",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * POST /api/video-calls/:sessionIdOrApptId/end
 * End an ongoing consultation session.
 */
export const endCall = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const sessionIdOrApptId = String(
      req.params.sessionIdOrApptId || req.params.appointmentId || "",
    );
    const { reason } = req.body || {};

    const result = await videoCallService.recordCallEnd({
      callSessionIdOrApptId: sessionIdOrApptId,
      endedByUserId: userId,
      reason,
    });

    return res.status(200).json({
      message: "Consultation call ended successfully.",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to end consultation call.",
      error: error.message || "Unknown error",
    });
  }
};

/**
 * GET /api/video/ice-servers
 * Exposes ICE servers (STUN/TURN) securely without exposing Metered API keys.
 */
export const getIceServers = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const iceServers = await videoCallService.getIceServers();
    return res.status(200).json({
      success: true,
      iceServers,
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ICE servers",
      error: error.message,
    });
  }
};
