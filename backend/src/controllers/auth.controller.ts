import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";

import AdminModel from "../models/admin.model.js";
import DoctorModel from "../models/doctor.model.js";
import PatientModel from "../models/patient.model.js";
import UserModel from "../models/user.model.js";
import type { AuthenticatedRequest, UserRole } from "../types/auth.js";

const validRoles: UserRole[] = ["patient", "doctor", "admin"];

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not defined in the environment");
  }

  return secret;
};

const generateToken = (userId: string, role: UserRole) => {
  const expiresIn = (process.env.JWT_EXPIRES_IN ||
    "7d") as SignOptions["expiresIn"];

  return jwt.sign({ id: userId, role }, getJwtSecret(), {
    expiresIn,
  });
};

const createRoleProfile = async (
  role: UserRole,
  userId: string,
  profile: Record<string, unknown> = {},
) => {
  if (role === "doctor") {
    return DoctorModel.create({ ...profile, user: userId });
  }

  if (role === "admin") {
    return AdminModel.create({ ...profile, user: userId });
  }

  return PatientModel.create({ ...profile, user: userId });
};

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = "patient", profile = {} } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      profile?: Record<string, unknown>;
    };

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Role must be patient, doctor, or admin",
      });
    }

    const existingUser = await UserModel.findOne({ email });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email is already registered",
      });
    }

    if (role === "doctor") {
      const doctorProfile = profile as Record<string, unknown>;
      const requiredDoctorFields = [
        "specialization",
        "qualification",
        "licenseNumber",
      ];

      const missingDoctorFields = requiredDoctorFields.filter(
        (field) => !doctorProfile[field],
      );

      if (missingDoctorFields.length > 0) {
        return res.status(400).json({
          success: false,
          message:
            "Doctor profile requires specialization, qualification, and licenseNumber",
        });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await UserModel.create({
      name,
      email,
      password: hashedPassword,
      role,
    });

    try {
      await createRoleProfile(role, user.id, profile);
    } catch (error) {
      await UserModel.findByIdAndDelete(user.id);
      throw error;
    }

    const token = generateToken(user.id, role);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to register user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const user = await UserModel.findOne({ email }).select("+password");

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = generateToken(user.id, user.role);

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to login",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await UserModel.findById(req.user?.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
