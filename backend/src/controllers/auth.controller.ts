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
      message: result.message || "User registered successfully",
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
      requiresEmailVerification: error.requiresEmailVerification || false,
      ...(error.email ? { email: error.email } : {}),
    });
  }
};

export const verifyOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };

    const result = await authService.verifyPatientOTP(email || "", otp || "");

    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to verify OTP",
      error: error.message || "Unknown error",
    });
  }
};

export const resendOTP = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    const result = await authService.resendPatientOTP(email || "");

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to resend OTP",
      error: error.message || "Unknown error",
    });
  }
};

export const sendOTP = async (req: Request, res: Response) => {
  return resendOTP(req, res);
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body as { email?: string };

    const result = await authService.forgotPassword(email || "");

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to process forgot password request",
      error: error.message || "Unknown error",
    });
  }
};

export const verifyForgotPasswordOTP = async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body as { email?: string; otp?: string };

    const result = await authService.verifyPasswordResetOTP(email || "", otp || "");

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to verify password reset code",
      error: error.message || "Unknown error",
    });
  }
};

export const resendForgotPasswordOTP = async (req: Request, res: Response) => {
  return forgotPassword(req, res);
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, resetToken, newPassword } = req.body as {
      email?: string;
      resetToken?: string;
      newPassword?: string;
    };

    const result = await authService.resetPassword({
      email,
      resetToken: resetToken || "",
      newPassword: newPassword || "",
    });

    return res.status(200).json(result);
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to reset password",
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

export const googlePatientAuth = async (req: Request, res: Response) => {
  try {
    const { credential } = req.body as { credential?: string };

    const result = await authService.loginPatientWithGoogle(credential);

    return res.status(200).json({
      success: true,
      message: "Google authentication successful",
      ...result,
    });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Google authentication failed",
      error: error.message || "Unknown error",
    });
  }
};

export const getGoogleAuthUrl = async (_req: Request, res: Response) => {
  try {
    const url = authService.getGoogleAuthUrl();
    return res.status(200).json({ success: true, url });
  } catch (error: any) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to generate Google auth URL",
      error: error.message || "Unknown error",
    });
  }
};

export const googleCallback = async (req: Request, res: Response) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  try {
    const { code, error } = req.query as { code?: string; error?: string };

    if (error) {
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    if (!code) {
      return res.redirect(`${frontendUrl}/login?error=No%20authorization%20code%20received%20from%20Google`);
    }

    const result = await authService.loginPatientWithGoogleCode(code);
    const userEncoded = encodeURIComponent(JSON.stringify(result.user));
    return res.redirect(
      `${frontendUrl}/login?google_token=${encodeURIComponent(result.token)}&google_user=${userEncoded}`
    );
  } catch (err: any) {
    const errorMsg = encodeURIComponent(err.message || "Google authentication failed");
    return res.redirect(`${frontendUrl}/login?error=${errorMsg}`);
  }
};


