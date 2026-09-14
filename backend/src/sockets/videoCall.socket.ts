import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import UserModel from "../models/user.model.js";
import { videoCallService } from "../container.js";
import type { JwtPayload } from "../types/auth.js";

export interface AuthenticatedSocket extends Socket {
  data: {
    user?: {
      id: string;
      role: string;
      name: string;
      email: string;
    };
    currentRoomId?: string;
    currentAppointmentId?: string;
    currentCallSessionId?: string;
  };
}

interface ParticipantInfo {
  socketId: string;
  userId: string;
  role: "patient" | "doctor";
  name: string;
}

// Map: roomIdentifier -> Map<userId, ParticipantInfo>
const activeConsultationRooms = new Map<string, Map<string, ParticipantInfo>>();

export const initializeVideoSocket = (io: Server) => {
  // 1. Socket Authentication Middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, "");

      if (!token) {
        return next(new Error("Authentication failed: JWT token missing"));
      }

      const secret = process.env.JWT_SECRET;
      if (!secret) {
        return next(new Error("Server configuration error: JWT_SECRET missing"));
      }

      const decoded = jwt.verify(token, secret) as JwtPayload;
      const user = await UserModel.findById(decoded.id);

      if (!user) {
        return next(new Error("Authentication failed: User record not found"));
      }

      socket.data.user = {
        id: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
      };

      return next();
    } catch (err: any) {
      return next(new Error("Authentication failed: Invalid or expired token"));
    }
  });

  // 2. Connection Handling
  io.on("connection", (socket: AuthenticatedSocket) => {
    const currentUser = socket.data.user;
    if (!currentUser) {
      socket.disconnect(true);
      return;
    }

    // Automatically join the user's private channel for direct notifications
    const userChannel = `user:${currentUser.id}`;
    socket.join(userChannel);

    console.log(
      `[VideoSocket] User connected: ${currentUser.name} (${currentUser.role}, id: ${currentUser.id}) - Socket ID: ${socket.id} (Channel: ${userChannel})`,
    );

    // Event: join-call / join-video-call
    const handleJoinCall = async (data: {
      appointmentId?: string;
      callSessionId?: string;
    }) => {
      const identifier = data?.callSessionId || data?.appointmentId;
      if (!identifier) {
        socket.emit("call-error", {
          code: "INVALID_IDENTIFIER",
          message: "Appointment ID or Call Session ID is required to join.",
        });
        return;
      }

      try {
        // Authorize access using VideoCallService
        const sessionDetails = await videoCallService.validateCallAccess({
          sessionIdOrApptId: identifier,
          userId: currentUser.id,
        });

        const roomKey = sessionDetails.roomId || sessionDetails.appointmentId;
        const socketRoom = `room:${roomKey}`;

        socket.join(socketRoom);
        socket.data.currentRoomId = socketRoom;
        socket.data.currentAppointmentId = sessionDetails.appointmentId;
        socket.data.currentCallSessionId = sessionDetails.callSession?.id;

        // Manage active participants
        if (!activeConsultationRooms.has(socketRoom)) {
          activeConsultationRooms.set(socketRoom, new Map());
        }

        const roomParticipants = activeConsultationRooms.get(socketRoom)!;
        const participantInfo: ParticipantInfo = {
          socketId: socket.id,
          userId: currentUser.id,
          role: sessionDetails.userRole as "patient" | "doctor",
          name: currentUser.name,
        };

        roomParticipants.set(currentUser.id, participantInfo);
        const totalParticipants = roomParticipants.size;

        console.log(
          `[VideoSocket] ${currentUser.name} (${sessionDetails.userRole}) joined ${socketRoom}. Total in room: ${totalParticipants}`,
        );

        // Notify joiner of room state
        socket.emit("room-joined", {
          appointmentId: sessionDetails.appointmentId,
          callSessionId: sessionDetails.callSession?.id,
          roomId: sessionDetails.roomId,
          participantCount: totalParticipants,
          isInitiator: totalParticipants > 1, // Second joiner initiates WebRTC offer
          sessionDetails,
        });

        // Also emit video-call-started alias
        socket.emit("video-call-started", {
          appointmentId: sessionDetails.appointmentId,
          callSessionId: sessionDetails.callSession?.id,
          roomId: sessionDetails.roomId,
          participantCount: totalParticipants,
        });

        // Notify other room participants
        socket.to(socketRoom).emit("participant-joined", {
          userId: currentUser.id,
          role: sessionDetails.userRole,
          name: currentUser.name,
        });
      } catch (error: any) {
        console.warn(
          `[VideoSocket] join-call authorization failed for user ${currentUser.id} on ${identifier}:`,
          error.message,
        );

        socket.emit("call-error", {
          code: "UNAUTHORIZED",
          message: error.message || "Unable to join video consultation.",
        });
      }
    };

    socket.on("join-call", handleJoinCall);
    socket.on("join-video-call", handleJoinCall);

    // Event: offer / webrtc-offer
    const handleOffer = (data: { sdp: any; appointmentId?: string; callSessionId?: string }) => {
      const room = socket.data.currentRoomId;
      if (!room || !data?.sdp) return;

      console.log(`[VideoSocket] Relaying SDP offer in ${room} from ${currentUser.name}`);
      socket.to(room).emit("offer", {
        sdp: data.sdp,
        senderId: socket.id,
        senderRole: currentUser.role,
      });
      socket.to(room).emit("webrtc-offer", {
        sdp: data.sdp,
        senderId: socket.id,
        senderRole: currentUser.role,
      });
    };
    socket.on("offer", handleOffer);
    socket.on("webrtc-offer", handleOffer);

    // Event: answer / webrtc-answer
    const handleAnswer = (data: { sdp: any; appointmentId?: string; callSessionId?: string }) => {
      const room = socket.data.currentRoomId;
      if (!room || !data?.sdp) return;

      console.log(`[VideoSocket] Relaying SDP answer in ${room} from ${currentUser.name}`);
      socket.to(room).emit("answer", {
        sdp: data.sdp,
        senderId: socket.id,
        senderRole: currentUser.role,
      });
      socket.to(room).emit("webrtc-answer", {
        sdp: data.sdp,
        senderId: socket.id,
        senderRole: currentUser.role,
      });
    };
    socket.on("answer", handleAnswer);
    socket.on("webrtc-answer", handleAnswer);

    // Event: ice-candidate / webrtc-ice-candidate
    const handleIceCandidate = (data: { candidate: any }) => {
      const room = socket.data.currentRoomId;
      if (!room || !data?.candidate) return;

      socket.to(room).emit("ice-candidate", {
        candidate: data.candidate,
        senderId: socket.id,
      });
      socket.to(room).emit("webrtc-ice-candidate", {
        candidate: data.candidate,
        senderId: socket.id,
      });
    };
    socket.on("ice-candidate", handleIceCandidate);
    socket.on("webrtc-ice-candidate", handleIceCandidate);

    // Event: send-chat-message (In-call clinical messaging & attachment sharing)
    const handleChatMessage = (data: {
      text?: string;
      attachment?: {
        name: string;
        type: string;
        size?: number;
        url: string;
      };
    }) => {
      const room = socket.data.currentRoomId;
      if (!room) return;

      const messagePayload = {
        id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        senderId: currentUser.id,
        senderName: currentUser.name,
        senderRole: currentUser.role,
        text: (data?.text || "").trim(),
        attachment: data?.attachment || null,
        timestamp: new Date().toISOString(),
      };

      console.log(`[VideoSocket] Chat message relayed in ${room} by ${currentUser.name}`);
      io.to(room).emit("new-chat-message", messagePayload);
    };
    socket.on("send-chat-message", handleChatMessage);
    socket.on("chat-message", handleChatMessage);

    // Event: end-call / end-video-call
    const handleEndCall = async (data: { reason?: string }) => {
      const room = socket.data.currentRoomId;
      const identifier =
        socket.data.currentCallSessionId || socket.data.currentAppointmentId;

      if (!room || !identifier) return;

      console.log(`[VideoSocket] Call ended in ${room} by ${currentUser.name}`);

      io.to(room).emit("call-ended", {
        endedBy: currentUser.role,
        endedByName: currentUser.name,
        reason: data?.reason || "Consultation concluded",
      });

      io.to(room).emit("video-call-ended", {
        endedBy: currentUser.role,
        endedByName: currentUser.name,
        reason: data?.reason || "Consultation concluded",
      });

      try {
        await videoCallService.recordCallEnd({
          callSessionIdOrApptId: identifier,
          endedByUserId: currentUser.id,
          reason: data?.reason,
        });
      } catch (e: any) {
        console.warn("[VideoSocket] Error recording call end:", e.message);
      }

      activeConsultationRooms.delete(room);
    };
    socket.on("end-call", handleEndCall);
    socket.on("end-video-call", handleEndCall);

    // Event: leave-call / leave-video-call
    const handleLeaveCall = () => {
      handleUserLeavingRoom(socket);
    };
    socket.on("leave-call", handleLeaveCall);
    socket.on("leave-video-call", handleLeaveCall);

    // Event: disconnect
    socket.on("disconnect", () => {
      console.log(
        `[VideoSocket] Socket disconnected: ${currentUser.name} (Socket ID: ${socket.id})`,
      );
      handleUserLeavingRoom(socket);
    });
  });

  const handleUserLeavingRoom = (socket: AuthenticatedSocket) => {
    const currentUser = socket.data.user;
    const room = socket.data.currentRoomId;
    if (!currentUser || !room) return;

    socket.leave(room);

    const roomParticipants = activeConsultationRooms.get(room);
    if (roomParticipants) {
      roomParticipants.delete(currentUser.id);
      if (roomParticipants.size === 0) {
        activeConsultationRooms.delete(room);
      } else {
        socket.to(room).emit("participant-left", {
          userId: currentUser.id,
          role: currentUser.role,
          name: currentUser.name,
        });
      }
    }

    socket.data.currentRoomId = undefined;
  };
};
