import crypto from "crypto";
import type { UserRole } from "../types/auth.js";
import { IUserRepository } from "../repositories/interfaces/IUserRepository.js";
import { IPasswordHasher } from "../core/security/IPasswordHasher.js";
import { ITokenService } from "../core/security/ITokenService.js";
import { RoleHandlerRegistry } from "../core/auth/handlers/RoleHandlerRegistry.js";
import {
  BadRequestError,
  ConflictError,
  EmailVerificationRequiredError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../core/errors/AppError.js";
import { IDoctorRepository } from "../repositories/interfaces/IDoctorRepository.js";
import { IGoogleAuthService } from "../infrastructure/security/GoogleAuthService.js";
import { OTPService } from "./otp.service.js";

export class AuthService {
  constructor(
    private userRepo: IUserRepository,
    private passwordHasher: IPasswordHasher,
    private tokenService: ITokenService,
    private roleRegistry: RoleHandlerRegistry,
    private googleAuthService?: IGoogleAuthService,
    private otpService?: OTPService,
    private doctorRepo?: IDoctorRepository,
  ) {}

  async registerUser(data: {
    name?: string;
    email?: string;
    password?: string;
    role?: UserRole;
    profile?: Record<string, unknown>;
  }) {
    const { name, email, password, role = "patient", profile = {} } = data;

    if (!name || !email || !password) {
      throw new BadRequestError("Name, email, and password are required");
    }

    if (!this.roleRegistry.hasRole(role)) {
      throw new BadRequestError("Role must be patient, doctor, or admin");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);

    // Patient & Doctor email verification flow
    if (role === "patient" || role === "doctor") {
      if (existingUser) {
        if (existingUser.isEmailVerified) {
          throw new ConflictError("Email is already registered");
        }

        // Email registered but unverified: update details & resend OTP
        const hashedPassword = await this.passwordHasher.hash(password);
        await this.userRepo.update(existingUser.id, {
          name,
          password: hashedPassword,
        });

        if (role === "doctor" && this.doctorRepo) {
          await this.doctorRepo.updateByUserId(existingUser.id, {
            ...profile,
            doctorApprovalStatus: "pending",
            verificationStatus: "pending",
            isEmailVerified: false,
          });
        }

        if (this.otpService) {
          await this.otpService.generateAndSendOTP(existingUser.email);
        }

        return {
          requiresEmailVerification: true,
          message: "A verification code has been sent to your email. Please verify to complete registration.",
          email: existingUser.email,
          user: {
            id: existingUser.id,
            name: existingUser.name,
            email: existingUser.email,
            role: existingUser.role,
          },
        };
      }

      // Fresh registration for patient or doctor
      const roleHandler = this.roleRegistry.getHandler(role);
      roleHandler.validateRegistrationProfile(profile);

      const hashedPassword = await this.passwordHasher.hash(password);
      const user = await this.userRepo.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        role,
        isEmailVerified: false,
      });

      try {
        await roleHandler.createProfile(user.id, profile);
      } catch (error) {
        await this.userRepo.findByIdAndDelete(user.id);
        throw error;
      }

      if (this.otpService) {
        await this.otpService.generateAndSendOTP(user.email);
      }

      return {
        requiresEmailVerification: true,
        message: "Registration successful. Please verify your email with the 6-digit code sent to your inbox.",
        email: user.email,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
      };
    }

    // Non-patient/doctor roles (Admin) registration
    if (existingUser) {
      throw new ConflictError("Email is already registered");
    }

    const roleHandler = this.roleRegistry.getHandler(role);
    roleHandler.validateRegistrationProfile(profile);

    const hashedPassword = await this.passwordHasher.hash(password);
    const user = await this.userRepo.create({
      name,
      email: normalizedEmail,
      password: hashedPassword,
      role,
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    try {
      await roleHandler.createProfile(user.id, profile);
    } catch (error) {
      await this.userRepo.findByIdAndDelete(user.id);
      throw error;
    }

    const token = this.tokenService.generateToken({ id: user.id, role });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async loginUser(data: { email?: string; password?: string }) {
    const { email, password } = data;

    if (!email || !password) {
      throw new BadRequestError("Email and password are required");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail, true);
    if (!user) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const passwordMatches = await this.passwordHasher.compare(password, (user as any).password);
    if (!passwordMatches) {
      throw new UnauthorizedError("Invalid email or password");
    }

    // Email verification guard for both patient and doctor
    if ((user.role === "patient" || user.role === "doctor") && user.authProvider !== "google" && !user.isEmailVerified) {
      throw new EmailVerificationRequiredError(
        "Please verify your email before logging in.",
        user.email,
      );
    }

    if (this.roleRegistry.hasRole(user.role)) {
      const roleHandler = this.roleRegistry.getHandler(user.role as UserRole);
      await roleHandler.validateLoginStatus(user.id);
    }

    let doctorApprovalStatus: string | undefined = undefined;
    if (user.role === "doctor" && this.doctorRepo) {
      const doc = await this.doctorRepo.findByUserId(user.id, false);
      if (doc) {
        doctorApprovalStatus = doc.doctorApprovalStatus || doc.verificationStatus || "pending";
      }
    }

    const token = this.tokenService.generateToken({ id: user.id, role: user.role as UserRole });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified ?? false,
        ...(doctorApprovalStatus ? { doctorApprovalStatus } : {}),
      },
    };
  }

  async verifyPatientOTP(email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestError("Email and verification code are required");
    }

    if (!this.otpService) {
      throw new BadRequestError("OTP verification service is not configured");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError("No account found with this email address");
    }

    // Verify OTP using secure OTP service
    await this.otpService.verifyOTP(normalizedEmail, otp);

    // Update account as verified
    await this.userRepo.update(user.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

    let doctorApprovalStatus: string | undefined = undefined;
    if (user.role === "doctor" && this.doctorRepo) {
      await this.doctorRepo.updateByUserId(user.id, {
        isEmailVerified: true,
      });
      const doc = await this.doctorRepo.findByUserId(user.id, false);
      if (doc) {
        doctorApprovalStatus = doc.doctorApprovalStatus || doc.verificationStatus || "pending";
      }
    }

    if (this.roleRegistry.hasRole(user.role)) {
      const roleHandler = this.roleRegistry.getHandler(user.role as UserRole);
      await roleHandler.validateLoginStatus(user.id);
    }

    const token = this.tokenService.generateToken({ id: user.id, role: user.role as UserRole });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: true,
        ...(doctorApprovalStatus ? { doctorApprovalStatus } : {}),
      },
    };
  }

  async resendPatientOTP(email: string) {
    if (!email) {
      throw new BadRequestError("Email address is required");
    }

    if (!this.otpService) {
      throw new BadRequestError("OTP service is not configured");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError("No account found with this email address");
    }

    if (user.isEmailVerified) {
      throw new BadRequestError("This email address is already verified. You can log in directly.");
    }

    const result = await this.otpService.generateAndSendOTP(normalizedEmail);

    return {
      success: true,
      message: "A new verification code has been sent to your email",
      cooldownSeconds: result.cooldownSeconds,
    };
  }

  async loginPatientWithGoogle(credential?: string) {
    if (!credential || typeof credential !== "string" || !credential.trim()) {
      throw new BadRequestError("Google credential token is required");
    }

    if (!this.googleAuthService) {
      throw new Error("Google authentication service is not configured");
    }

    const verifiedUser = await this.googleAuthService.verifyIdToken(credential);
    return this.processGooglePatient(verifiedUser);
  }

  async loginPatientWithGoogleCode(code?: string) {
    if (!code || typeof code !== "string" || !code.trim()) {
      throw new BadRequestError("Google authorization code is required");
    }

    if (!this.googleAuthService || !this.googleAuthService.verifyAuthorizationCode) {
      throw new Error("Google authorization code verification is not supported");
    }

    const verifiedUser = await this.googleAuthService.verifyAuthorizationCode(code);
    return this.processGooglePatient(verifiedUser);
  }

  getGoogleAuthUrl(): string {
    if (!this.googleAuthService || !this.googleAuthService.getAuthorizationUrl) {
      throw new Error("Google authorization URL generation is not configured");
    }
    return this.googleAuthService.getAuthorizationUrl();
  }

  private async processGooglePatient(verifiedUser: {
    googleId: string;
    email: string;
    name: string;
    picture?: string;
  }) {
    const { googleId, email, name, picture } = verifiedUser;

    let user = await this.userRepo.findByEmail(email);

    if (user) {
      // Role enforcement: Never allow Google login to authenticate or alter an admin or doctor
      if (user.role !== "patient") {
        throw new ForbiddenError(
          `An account with this email already exists as a ${user.role}. Google sign-in is only available for patient accounts. Please sign in with your credentials.`
        );
      }

      // Check account status (e.g. active / not blocked)
      if (this.roleRegistry.hasRole("patient")) {
        const roleHandler = this.roleRegistry.getHandler("patient");
        await roleHandler.validateLoginStatus(user.id);
      }

      // Mark email as verified for Google OAuth and link Google ID if needed
      const updateData: Record<string, unknown> = {
        isEmailVerified: true,
        emailVerifiedAt: (user as any).emailVerifiedAt || new Date(),
      };

      if (!user.googleId) {
        updateData.googleId = googleId;
        updateData.authProvider = user.authProvider || "google";
      }

      const updated = await this.userRepo.update(user.id, updateData);
      if (updated) {
        user = updated;
      }
    } else {
      // Automatically create new Patient account with isEmailVerified: true
      user = await this.userRepo.create({
        name: name || "Patient",
        email,
        role: "patient",
        authProvider: "google",
        googleId,
        isEmailVerified: true,
        emailVerifiedAt: new Date(),
      });

      // Create Patient profile
      try {
        const roleHandler = this.roleRegistry.getHandler("patient");
        await roleHandler.createProfile(user.id, {
          profileImage: picture || "",
        });
      } catch (error) {
        await this.userRepo.findByIdAndDelete(user.id);
        throw error;
      }
    }

    const token = this.tokenService.generateToken({ id: user.id, role: "patient" });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        authProvider: user.authProvider || "google",
      },
    };
  }

  async getMe(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    let doctorApprovalStatus: string | undefined = undefined;
    let verificationStatus: string | undefined = undefined;
    if (user.role === "doctor" && this.doctorRepo) {
      const doc = await this.doctorRepo.findByUserId(user.id, false);
      if (doc) {
        doctorApprovalStatus = doc.doctorApprovalStatus || doc.verificationStatus || "pending";
        verificationStatus = doc.verificationStatus || "pending";
      }
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified ?? false,
      ...(doctorApprovalStatus ? { doctorApprovalStatus, verificationStatus } : {}),
    };
  }

  async forgotPassword(email: string) {
    if (!email || typeof email !== "string") {
      throw new BadRequestError("Please provide a valid email address");
    }

    const normalizedEmail = email.toLowerCase().trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestError("Please provide a valid email address");
    }

    if (!this.otpService) {
      throw new BadRequestError("OTP service is not configured");
    }

    const user = await this.userRepo.findByEmail(normalizedEmail);

    // ANTI-ENUMERATION:
    // If the account does not exist, or is not a patient, or was created via Google OAuth (no local password):
    // Return the exact same generic success response without leaking existence or sending an OTP email.
    const GENERIC_RESPONSE = {
      success: true,
      message: "If an account is associated with this email, a 6-digit password reset code has been sent.",
      cooldownSeconds: 60,
    };

    if (!user || user.role !== "patient" || user.authProvider === "google") {
      return GENERIC_RESPONSE;
    }

    const result = await this.otpService.generateAndSendPasswordResetOTP(normalizedEmail);

    return {
      success: true,
      message: "If an account is associated with this email, a 6-digit password reset code has been sent.",
      cooldownSeconds: result.cooldownSeconds,
    };
  }

  async resendPasswordResetOTP(email: string) {
    return this.forgotPassword(email);
  }

  async verifyPasswordResetOTP(email: string, otp: string) {
    if (!email || !otp) {
      throw new BadRequestError("Email and verification code are required");
    }

    if (!this.otpService) {
      throw new BadRequestError("OTP verification service is not configured");
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await this.userRepo.findByEmail(normalizedEmail);

    if (!user || user.role !== "patient") {
      throw new BadRequestError("Invalid or expired password reset code. Please request a new code.");
    }

    // Verify OTP (enforces 10 min expiry, 5 max attempts, invalidation on max attempts)
    await this.otpService.verifyPasswordResetOTP(normalizedEmail, otp);

    // Generate cryptographically secure random reset token
    const rawResetToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawResetToken).digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes validity

    // Store token hash & expiration on user document
    await this.userRepo.update(user.id, {
      passwordResetTokenHash: tokenHash,
      passwordResetExpires: tokenExpiresAt,
    } as any);

    return {
      success: true,
      message: "Verification code confirmed. You can now set your new password.",
      resetToken: rawResetToken,
      email: user.email,
    };
  }

  async resetPassword(data: { email?: string; resetToken: string; newPassword: string }) {
    const { email, resetToken, newPassword } = data;

    if (!resetToken || typeof resetToken !== "string" || !resetToken.trim()) {
      throw new BadRequestError("Reset token is required");
    }

    if (!newPassword || typeof newPassword !== "string" || newPassword.length < 6) {
      throw new BadRequestError("Password must be at least 6 characters long");
    }

    const rawToken = resetToken.trim();
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

    let user: any = null;
    if (email && typeof email === "string" && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      user = await this.userRepo.findByEmail(normalizedEmail);
    } else {
      const users = await this.userRepo.find({ passwordResetTokenHash: tokenHash });
      user = users[0] || null;
    }

    if (!user || user.role !== "patient") {
      throw new BadRequestError("Invalid or expired password reset token. Please request a new code.");
    }

    // Check token match
    if (!user.passwordResetTokenHash || user.passwordResetTokenHash !== tokenHash) {
      throw new BadRequestError("Invalid or already used password reset token. Please request a new code.");
    }

    // Check token expiration (15 minutes)
    if (!user.passwordResetExpires || new Date() > new Date(user.passwordResetExpires)) {
      throw new BadRequestError("Password reset token has expired. Please request a new code.");
    }

    // Hash the new password using existing password hasher
    const hashedPassword = await this.passwordHasher.hash(newPassword);

    // Update user: set new password, and clear reset token fields to PREVENT REUSE
    await this.userRepo.update(user.id, {
      password: hashedPassword,
      passwordResetTokenHash: null as any,
      passwordResetExpires: null as any,
    } as any);

    return {
      success: true,
      message: "Password reset successful. You can now log in with your new password.",
    };
  }
}
