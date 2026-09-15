import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { AuthService } from "../services/auth.service.js";
import { OTPService } from "../services/otp.service.js";
import { RoleHandlerRegistry } from "../core/auth/handlers/RoleHandlerRegistry.js";
import { PatientRoleHandler } from "../core/auth/handlers/PatientRoleHandler.js";
import { DoctorRoleHandler } from "../core/auth/handlers/DoctorRoleHandler.js";
import { AdminRoleHandler } from "../core/auth/handlers/AdminRoleHandler.js";
import { MockEmailService } from "../infrastructure/email/MockEmailService.js";
import { IOTPRepository, OTPDocument } from "../repositories/interfaces/IOTPRepository.js";
import { BadRequestError, UnauthorizedError } from "../core/errors/AppError.js";

// In-memory OTP Repository
class MockOTPRepo implements IOTPRepository {
  public records: any[] = [];

  async create(data: {
    email: string;
    otpHash: string;
    expiresAt: Date;
    purpose?: string;
  }): Promise<OTPDocument> {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      email: data.email.toLowerCase().trim(),
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      purpose: data.purpose || "email_verification",
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      usedAt: null,
    };
    this.records.push(doc);
    return { ...doc } as unknown as OTPDocument;
  }

  async findLatestByEmail(email: string, purpose = "email_verification"): Promise<OTPDocument | null> {
    const found = [...this.records]
      .reverse()
      .find((r) => r.email === email.toLowerCase().trim() && r.purpose === purpose);
    return found ? (found as unknown as OTPDocument) : null;
  }

  async incrementAttempts(id: any): Promise<OTPDocument | null> {
    const item = this.records.find((r) => r.id === id.toString() || r._id?.toString() === id.toString());
    if (item) {
      item.attempts += 1;
      return { ...item } as unknown as OTPDocument;
    }
    return null;
  }

  async markAsUsed(id: any): Promise<OTPDocument | null> {
    const item = this.records.find((r) => r.id === id.toString() || r._id?.toString() === id.toString());
    if (item) {
      item.usedAt = new Date();
      return { ...item } as unknown as OTPDocument;
    }
    return null;
  }

  async deleteByEmail(email: string, purpose?: string): Promise<void> {
    this.records = this.records.filter((r) => {
      const matchEmail = r.email === email.toLowerCase().trim();
      const matchPurpose = !purpose || r.purpose === purpose;
      return !(matchEmail && matchPurpose);
    });
  }

  async deleteById(id: any): Promise<void> {
    this.records = this.records.filter((r) => r.id !== id.toString() && r._id?.toString() !== id.toString());
  }
}

// In-memory User Repository
class MockUserRepo {
  public users: any[] = [];

  async findByEmail(email: string, _selectPassword = false) {
    const found = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase().trim());
    return found ? { ...found } : null;
  }

  async findById(id: any) {
    const found = this.users.find((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    return found ? { ...found } : null;
  }

  async find(filter: Record<string, unknown> = {}) {
    return this.users.filter((u) => {
      for (const [key, val] of Object.entries(filter)) {
        if (u[key] !== val) return false;
      }
      return true;
    });
  }

  async create(userData: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      authProvider: userData.authProvider || "local",
      isEmailVerified: userData.isEmailVerified ?? false,
      passwordResetTokenHash: null,
      passwordResetExpires: null,
      ...userData,
    };
    this.users.push(doc);
    return { ...doc };
  }

  async update(id: any, userData: any) {
    const idx = this.users.findIndex((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    if (idx === -1) return null;
    this.users[idx] = { ...this.users[idx], ...userData };
    return { ...this.users[idx] };
  }

  async findByIdAndDelete(id: any) {
    const idx = this.users.findIndex((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    if (idx !== -1) {
      const removed = this.users.splice(idx, 1);
      return removed[0];
    }
    return null;
  }
}

// Mock Patient Repository
class MockPatientRepo {
  public patients: any[] = [];
  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), id: new Types.ObjectId().toString(), ...data };
    this.patients.push(doc);
    return doc;
  }
  async findByUserId(userId: any) {
    return this.patients.find((p) => p.user?.toString() === userId.toString()) || null;
  }
}

// Mock Doctor Repository
class MockDoctorRepo {
  public doctors: any[] = [];
  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), id: new Types.ObjectId().toString(), ...data };
    this.doctors.push(doc);
    return doc;
  }
  async findByUserId(userId: any) {
    return this.doctors.find((d) => d.user?.toString() === userId.toString()) || null;
  }
}

// Mock Admin Repository
class MockAdminRepo {
  public admins: any[] = [];
  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), id: new Types.ObjectId().toString(), ...data };
    this.admins.push(doc);
    return doc;
  }
  async findByUserId(userId: any) {
    return this.admins.find((a) => a.user?.toString() === userId.toString()) || null;
  }
}

// Mock Password Hasher
class MockPasswordHasher {
  async hash(plain: string): Promise<string> {
    return `hashed_${plain}`;
  }
  async compare(plain: string, hashed: string): Promise<boolean> {
    return hashed === `hashed_${plain}`;
  }
}

// Mock Token Service
class MockTokenService {
  generateToken(payload: any): string {
    return `mock_token_${payload.id}_${payload.role}`;
  }
  verifyToken(token: string): any {
    const parts = token.split("_");
    return { id: parts[2], role: parts[3] };
  }
}

describe("HelthGate Patient Forgot Password & OTP Flow Tests", () => {
  let userRepo: MockUserRepo;
  let otpRepo: MockOTPRepo;
  let patientRepo: MockPatientRepo;
  let doctorRepo: MockDoctorRepo;
  let adminRepo: MockAdminRepo;
  let emailService: MockEmailService;
  let passwordHasher: MockPasswordHasher;
  let tokenService: MockTokenService;
  let roleRegistry: RoleHandlerRegistry;
  let otpService: OTPService;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new MockUserRepo();
    otpRepo = new MockOTPRepo();
    patientRepo = new MockPatientRepo();
    doctorRepo = new MockDoctorRepo();
    adminRepo = new MockAdminRepo();
    emailService = new MockEmailService();
    passwordHasher = new MockPasswordHasher();
    tokenService = new MockTokenService();

    roleRegistry = new RoleHandlerRegistry();
    roleRegistry.register("patient", new PatientRoleHandler(patientRepo as any));
    roleRegistry.register("doctor", new DoctorRoleHandler(doctorRepo as any));
    roleRegistry.register("admin", new AdminRoleHandler(adminRepo as any));

    otpService = new OTPService(otpRepo, emailService);
    authService = new AuthService(
      userRepo as any,
      passwordHasher as any,
      tokenService as any,
      roleRegistry,
      undefined,
      otpService,
    );
  });

  it("1. Patient requesting forgot password receives 6-digit OTP via email", async () => {
    await userRepo.create({
      name: "Alice Patient",
      email: "alice@example.com",
      password: "hashed_OldPassword123",
      role: "patient",
      isEmailVerified: true,
    });

    const response = await authService.forgotPassword("alice@example.com");

    assert.equal(response.success, true);
    assert.equal(response.cooldownSeconds, 60);
    assert.equal(emailService.sentEmails.length, 1);
    assert.equal(emailService.sentEmails[0].to, "alice@example.com");
    assert.match(emailService.sentEmails[0].subject, /Reset Your Password/i);
    assert.match(emailService.sentEmails[0].text!, /\d{6}/);
  });

  it("2. Plain-text OTP is never stored in DB (SHA-256 hash verified)", async () => {
    await userRepo.create({
      name: "Bob Patient",
      email: "bob@example.com",
      password: "hashed_OldPassword123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("bob@example.com");

    const sentText = emailService.sentEmails[0].text!;
    const otpMatch = sentText.match(/\b\d{6}\b/);
    assert.ok(otpMatch, "Plaintext OTP must be present in sent email");
    const plainOtp = otpMatch[0];

    const storedRecord = await otpRepo.findLatestByEmail("bob@example.com", "password_reset");
    assert.ok(storedRecord);
    assert.notEqual(storedRecord.otpHash, plainOtp);
    assert.equal(storedRecord.purpose, "password_reset");

    const expectedHash = otpService.hashOTP(plainOtp);
    assert.equal(storedRecord.otpHash, expectedHash);
  });

  it("3. Non-existent email returns generic success response without sending email (anti-enumeration)", async () => {
    const response = await authService.forgotPassword("ghost@example.com");

    assert.equal(response.success, true);
    assert.match(response.message, /If an account is associated with this email/i);
    assert.equal(emailService.sentEmails.length, 0, "No email should be sent for non-existent users");
  });

  it("4. Doctor account entering forgot password returns generic success response without sending email", async () => {
    await userRepo.create({
      name: "Dr. Smith",
      email: "doctor.smith@example.com",
      password: "hashed_DoctorSecret123",
      role: "doctor",
      isEmailVerified: true,
    });

    const response = await authService.forgotPassword("doctor.smith@example.com");

    assert.equal(response.success, true);
    assert.match(response.message, /If an account is associated with this email/i);
    assert.equal(emailService.sentEmails.length, 0, "Doctor accounts cannot use patient forgot-password");
  });

  it("5. Admin account entering forgot password returns generic success response without sending email", async () => {
    await userRepo.create({
      name: "Super Admin",
      email: "admin@helthgate.com",
      password: "hashed_AdminSecret123",
      role: "admin",
      isEmailVerified: true,
    });

    const response = await authService.forgotPassword("admin@helthgate.com");

    assert.equal(response.success, true);
    assert.match(response.message, /If an account is associated with this email/i);
    assert.equal(emailService.sentEmails.length, 0, "Admin accounts cannot use patient forgot-password");
  });

  it("6. Google-authenticated patient returns generic success response without sending email", async () => {
    await userRepo.create({
      name: "Google Patient",
      email: "google.patient@example.com",
      role: "patient",
      authProvider: "google",
      googleId: "google-123456",
      isEmailVerified: true,
    });

    const response = await authService.forgotPassword("google.patient@example.com");

    assert.equal(response.success, true);
    assert.match(response.message, /If an account is associated with this email/i);
    assert.equal(emailService.sentEmails.length, 0, "Google OAuth accounts do not have local passwords to reset");
  });

  it("7. Resend OTP enforces 60-second cooldown", async () => {
    await userRepo.create({
      name: "Charlie",
      email: "charlie@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("charlie@example.com");

    // Immediate second request within 60s
    await assert.rejects(
      async () => {
        await authService.forgotPassword("charlie@example.com");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /Please wait \d+ seconds before requesting a new password reset code/i);
        return true;
      }
    );
  });

  it("8. Resending OTP after cooldown invalidates previous code and sends a fresh one", async () => {
    await userRepo.create({
      name: "Diana",
      email: "diana@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("diana@example.com");
    const firstOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];

    // Simulate 61 seconds passing
    const stored = await otpRepo.findLatestByEmail("diana@example.com", "password_reset");
    (stored as any).createdAt = new Date(Date.now() - 65 * 1000);

    await authService.forgotPassword("diana@example.com");
    assert.equal(emailService.sentEmails.length, 2);

    const secondOtp = emailService.sentEmails[1].text!.match(/\b\d{6}\b/)![0];

    // Old OTP should be rejected
    await assert.rejects(
      async () => {
        await authService.verifyPasswordResetOTP("diana@example.com", firstOtp);
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        return true;
      }
    );

    // New OTP should succeed
    const verifyRes = await authService.verifyPasswordResetOTP("diana@example.com", secondOtp);
    assert.equal(verifyRes.success, true);
  });

  it("9. Expired OTP (>10 minutes) is rejected", async () => {
    await userRepo.create({
      name: "Eve",
      email: "eve@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("eve@example.com");
    const otp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];

    // Age the OTP beyond 10 minutes
    const stored = await otpRepo.findLatestByEmail("eve@example.com", "password_reset");
    (stored as any).createdAt = new Date(Date.now() - 15 * 60 * 1000);
    (stored as any).expiresAt = new Date(Date.now() - 5 * 60 * 1000);

    await assert.rejects(
      async () => {
        await authService.verifyPasswordResetOTP("eve@example.com", otp);
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /expired/i);
        return true;
      }
    );
  });

  it("10. Invalid OTP attempt increments attempt counter and reports remaining attempts", async () => {
    await userRepo.create({
      name: "Frank",
      email: "frank@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("frank@example.com");

    await assert.rejects(
      async () => {
        await authService.verifyPasswordResetOTP("frank@example.com", "000000");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /4 attempts remaining/i);
        return true;
      }
    );
  });

  it("11. Five failed attempts invalidates the OTP completely", async () => {
    await userRepo.create({
      name: "Grace",
      email: "grace@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("grace@example.com");

    for (let i = 0; i < 4; i++) {
      await assert.rejects(
        async () => {
          await authService.verifyPasswordResetOTP("grace@example.com", "111111");
        },
        BadRequestError
      );
    }

    // 5th attempt
    await assert.rejects(
      async () => {
        await authService.verifyPasswordResetOTP("grace@example.com", "111111");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /Maximum verification attempts exceeded/i);
        return true;
      }
    );

    // Ensure OTP record was deleted
    const record = await otpRepo.findLatestByEmail("grace@example.com", "password_reset");
    assert.equal(record, null);
  });

  it("12. Valid OTP verification produces a short-lived reset token", async () => {
    await userRepo.create({
      name: "Hannah",
      email: "hannah@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("hannah@example.com");
    const plainOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];

    const result = await authService.verifyPasswordResetOTP("hannah@example.com", plainOtp);

    assert.equal(result.success, true);
    assert.ok(result.resetToken);
    assert.equal(typeof result.resetToken, "string");
    assert.equal(result.resetToken.length, 64); // 32 bytes hex = 64 characters

    const user = await userRepo.findByEmail("hannah@example.com");
    assert.ok(user?.passwordResetTokenHash);
    assert.ok(user?.passwordResetExpires);
  });

  it("13. Reset password updates user password using Bcrypt hasher", async () => {
    await userRepo.create({
      name: "Ian",
      email: "ian@example.com",
      password: "hashed_OldPassword123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("ian@example.com");
    const plainOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];
    const verifyRes = await authService.verifyPasswordResetOTP("ian@example.com", plainOtp);

    const resetRes = await authService.resetPassword({
      email: "ian@example.com",
      resetToken: verifyRes.resetToken,
      newPassword: "BrandNewSecurePassword456",
    });

    assert.equal(resetRes.success, true);
    assert.match(resetRes.message, /Password reset successful/i);

    const updatedUser = await userRepo.findByEmail("ian@example.com");
    assert.equal(updatedUser?.password, "hashed_BrandNewSecurePassword456");
  });

  it("14. Reusing the reset token is strictly prevented and rejected", async () => {
    await userRepo.create({
      name: "Jack",
      email: "jack@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("jack@example.com");
    const plainOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];
    const verifyRes = await authService.verifyPasswordResetOTP("jack@example.com", plainOtp);

    // First reset succeeds
    await authService.resetPassword({
      email: "jack@example.com",
      resetToken: verifyRes.resetToken,
      newPassword: "NewPassword1",
    });

    // Replaying the same resetToken must fail immediately
    await assert.rejects(
      async () => {
        await authService.resetPassword({
          email: "jack@example.com",
          resetToken: verifyRes.resetToken,
          newPassword: "NewPassword2",
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /Invalid or already used/i);
        return true;
      }
    );
  });

  it("15. Expired reset token is rejected", async () => {
    await userRepo.create({
      name: "Karen",
      email: "karen@example.com",
      password: "hashed_Pass123",
      role: "patient",
      isEmailVerified: true,
    });

    await authService.forgotPassword("karen@example.com");
    const plainOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];
    const verifyRes = await authService.verifyPasswordResetOTP("karen@example.com", plainOtp);

    // Expire the token in DB
    const user = await userRepo.findByEmail("karen@example.com");
    await userRepo.update(user!.id, {
      passwordResetExpires: new Date(Date.now() - 5 * 60 * 1000),
    });

    await assert.rejects(
      async () => {
        await authService.resetPassword({
          email: "karen@example.com",
          resetToken: verifyRes.resetToken,
          newPassword: "NewPasswordKaren",
        });
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /expired/i);
        return true;
      }
    );
  });

  it("16. Patient can successfully log in with new password after reset", async () => {
    const user = await userRepo.create({
      name: "Leo",
      email: "leo@example.com",
      password: "hashed_OldPass",
      role: "patient",
      isEmailVerified: true,
    });
    await patientRepo.create({ user: user.id, active: true });

    // Old password works
    const oldLogin = await authService.loginUser({
      email: "leo@example.com",
      password: "OldPass",
    });
    assert.ok(oldLogin.token);

    // Reset password
    await authService.forgotPassword("leo@example.com");
    const plainOtp = emailService.sentEmails[0].text!.match(/\b\d{6}\b/)![0];
    const verifyRes = await authService.verifyPasswordResetOTP("leo@example.com", plainOtp);

    await authService.resetPassword({
      email: "leo@example.com",
      resetToken: verifyRes.resetToken,
      newPassword: "FreshPassword789",
    });

    // Old password now fails
    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: "leo@example.com",
          password: "OldPass",
        });
      },
      UnauthorizedError
    );

    // New password succeeds
    const newLogin = await authService.loginUser({
      email: "leo@example.com",
      password: "FreshPassword789",
    });
    assert.ok(newLogin.token);
    assert.equal(newLogin.user.email, "leo@example.com");
  });
});
