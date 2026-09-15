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

    // Patient email verification flow
    if (role === "patient") {
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

      // Fresh patient registration
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

    // Non-patient roles (Doctor, Admin) registration
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

    // Patient email verification guard
    if (user.role === "patient" && user.authProvider !== "google" && !user.isEmailVerified) {
      throw new EmailVerificationRequiredError(
        "Please verify your email before logging in.",
        user.email,
      );
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

    // Update patient account as verified
    await this.userRepo.update(user.id, {
      isEmailVerified: true,
      emailVerifiedAt: new Date(),
    });

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

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }
}
