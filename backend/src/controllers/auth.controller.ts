import type { Request, Response } from "express";
import type { AuthenticatedRequest, UserRole } from "../types/auth.js";
import { authService } from "../container.js";

export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, password, role = "patient", profile = {} } = req.body as {
      name?: string;
      email?: string;
      password?: string;
      role?: UserRole;
      profile?: Record<string, unknown>;
    };

    const result = await authService.registerUser({
      name,
      email,
      password,
      role,
      profile,
    });

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to register user",
      error: error.message || "Unknown error",
    });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body as {
      email?: string;
      password?: string;
    };

    const result = await authService.loginUser({ email, password });

    return res.status(200).json({
      success: true,
      message: "Logged in successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to login",
      error: error.message || "Unknown error",
    });
  }
};

export const getMe = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await authService.getMe(userId);

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to fetch user",
      error: error.message || "Unknown error",
    });
  }
};
