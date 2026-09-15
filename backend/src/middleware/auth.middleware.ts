import type { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";

import UserModel from "../models/user.model.js";
import DoctorModel from "../models/doctor.model.js";
import type {
  AuthenticatedRequest,
  JwtPayload,
  UserRole,
} from "../types/auth.js";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in the environment");
  }

  return secret;
};

export const protect = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = await UserModel.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
      });
    }

    req.user = {
      id: user.id,
      role: user.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Not authorized, token invalid",
    });
  }
};

export const authorize = (...roles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Forbidden, insufficient role",
      });
    }

    return next();
  };
};

export const adminOnly = authorize("admin");

export const requireApprovedDoctor = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user || req.user.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Forbidden, doctor role required",
      });
    }

    const user = await UserModel.findById(req.user.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Not authorized, user not found",
      });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        requiresEmailVerification: true,
        message: "Please verify your email before accessing doctor services",
      });
    }

    const doctor = await DoctorModel.findOne({ user: user._id });
    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor profile not found",
      });
    }

    const isApproved =
      doctor.doctorApprovalStatus === "approved" ||
      doctor.verificationStatus === "verified" ||
      doctor.verificationStatus === "approved";

    if (!isApproved) {
      const isRejected =
        doctor.doctorApprovalStatus === "rejected" ||
        doctor.verificationStatus === "rejected";

      return res.status(403).json({
        success: false,
        code: isRejected ? "DOCTOR_REJECTED" : "DOCTOR_APPROVAL_PENDING",
        doctorApprovalStatus: doctor.doctorApprovalStatus || doctor.verificationStatus || "pending",
        message: isRejected
          ? "Doctor account has been rejected by the administrator"
          : "Your doctor account is currently pending administrator approval",
      });
    }

    if (!doctor.active) {
      return res.status(403).json({
        success: false,
        message: "Doctor account is currently deactivated",
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Error verifying doctor approval status",
    });
  }
};
