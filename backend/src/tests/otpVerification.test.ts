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
import { BadRequestError, ConflictError, EmailVerificationRequiredError } from "../core/errors/AppError.js";

// In-memory OTP Repository
class MockOTPRepo implements IOTPRepository {
  public records: any[] = [];

  async create(data: { email: string; otpHash: string; expiresAt: Date }): Promise<OTPDocument> {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      email: data.email.toLowerCase().trim(),
      otpHash: data.otpHash,
      expiresAt: data.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      attempts: 0,
      usedAt: null,
    };
    this.records.push(doc);
    return { ...doc } as unknown as OTPDocument;
  }

  async findLatestByEmail(email: string): Promise<OTPDocument | null> {
    const found = [...this.records]
      .reverse()
      .find((r) => r.email === email.toLowerCase().trim());
    return found ? ({ ...found } as unknown as OTPDocument) : null;
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

  async deleteByEmail(email: string): Promise<void> {
    this.records = this.records.filter((r) => r.email !== email.toLowerCase().trim());
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

  async create(userData: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      authProvider: userData.authProvider || "local",
      isEmailVerified: userData.isEmailVerified ?? false,
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
    this.users = this.users.filter((u) => u.id !== id.toString() && u._id?.toString() !== id.toString());
  }
}

// In-memory Patient Repository
class MockPatientRepo {
  public patients: any[] = [];
  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), id: new Types.ObjectId().toString(), active: true, ...data };
    this.patients.push(doc);
    return doc;
  }
  async findByUserId(userId: any) {
    return this.patients.find((p) => p.user?.toString() === userId.toString()) || null;
  }
}

// Mock Password Hasher
class MockPasswordHasher {
  async hash(password: string): Promise<string> {
    return `hashed_${password}`;
  }
  async compare(password: string, hash: string): Promise<boolean> {
    return hash === `hashed_${password}`;
  }
}

// Mock Token Service
class MockTokenService {
  generateToken(payload: any): string {
    return `jwt_token_${payload.id}_${payload.role}`;
  }
  verifyToken(_token: string): any {
    return { id: "mock_id", role: "patient" };
  }
}

describe("HelthGate Email OTP Verification & Nodemailer Integration Tests", () => {
  let userRepo: MockUserRepo;
  let patientRepo: MockPatientRepo;
  let otpRepo: MockOTPRepo;
  let emailService: MockEmailService;
  let otpService: OTPService;
  let authService: AuthService;

  beforeEach(() => {
    userRepo = new MockUserRepo();
    patientRepo = new MockPatientRepo();
    otpRepo = new MockOTPRepo();
    emailService = new MockEmailService();
    otpService = new OTPService(otpRepo, emailService);

    const roleRegistry = new RoleHandlerRegistry();
    roleRegistry.register("patient", new PatientRoleHandler(patientRepo as any));
    roleRegistry.register("doctor", new DoctorRoleHandler({} as any));
    roleRegistry.register("admin", new AdminRoleHandler({} as any));

    authService = new AuthService(
      userRepo as any,
      new MockPasswordHasher(),
      new MockTokenService(),
      roleRegistry,
      undefined,
      otpService,
    );
  });

  it("1. Patient registration creates unverified account and sends 6-digit OTP via email", async () => {
    const result = await authService.registerUser({
      name: "Alice Patient",
      email: "alice@example.com",
      password: "securePassword123",
      role: "patient",
    });

    assert.equal(result.requiresEmailVerification, true);
    assert.equal(result.email, "alice@example.com");
    assert.ok(!("token" in result), "JWT token should not be issued before email verification");

    // Check user in database
    const userInDb = await userRepo.findByEmail("alice@example.com");
    assert.ok(userInDb);
    assert.equal(userInDb.isEmailVerified, false);

    // Check outbound email
    assert.equal(emailService.sentEmails.length, 1);
    assert.equal(emailService.sentEmails[0].to, "alice@example.com");
    assert.match(emailService.sentEmails[0].subject, /Verify Your Email/i);

    // Check OTP record in DB
    const otpInDb = await otpRepo.findLatestByEmail("alice@example.com");
    assert.ok(otpInDb);
    assert.ok(otpInDb.otpHash);
    assert.notEqual(otpInDb.otpHash.length, 6, "OTP hash must NOT be stored in plain text");
    assert.equal(otpInDb.attempts, 0);
  });

  it("2. Plain-text OTP is never stored in database (SHA-256 hashing verified)", async () => {
    await otpService.generateAndSendOTP("security@example.com");

    const sentEmail = emailService.sentEmails[0];
    const match = sentEmail.text?.match(/\b\d{6}\b/);
    assert.ok(match, "Sent email must contain 6-digit OTP code");
    const plainOtp = match[0];

    const record = await otpRepo.findLatestByEmail("security@example.com");
    assert.ok(record);
    assert.notEqual(record.otpHash, plainOtp, "OTP hash must not equal plaintext OTP");
    assert.equal(record.otpHash, otpService.hashOTP(plainOtp), "Stored hash must match SHA-256 of plain OTP");
  });

  it("3. Valid OTP verification marks email as verified and issues JWT token", async () => {
    await authService.registerUser({
      name: "Bob Patient",
      email: "bob@example.com",
      password: "password123",
      role: "patient",
    });

    const sentEmail = emailService.sentEmails[0];
    const plainOtp = sentEmail.text?.match(/\b\d{6}\b/)?.[0] || "";

    const verifyResult = await authService.verifyPatientOTP("bob@example.com", plainOtp);
    assert.ok(verifyResult.token, "Verification must issue authentication token");
    assert.equal(verifyResult.user.email, "bob@example.com");

    const user = await userRepo.findByEmail("bob@example.com");
    assert.equal(user?.isEmailVerified, true);
    assert.ok(user?.emailVerifiedAt);

    // Verified OTP cannot be reused
    await assert.rejects(
      async () => {
        await authService.verifyPatientOTP("bob@example.com", plainOtp);
      },
      (err: any) => err instanceof BadRequestError && err.message.includes("used")
    );
  });

  it("4. Unverified patient login is rejected with requiresEmailVerification", async () => {
    await authService.registerUser({
      name: "Charlie Unverified",
      email: "charlie@example.com",
      password: "myPassword123",
      role: "patient",
    });

    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: "charlie@example.com",
          password: "myPassword123",
        });
      },
      (err: any) => {
        assert.ok(err instanceof EmailVerificationRequiredError);
        assert.equal(err.requiresEmailVerification, true);
        assert.equal(err.statusCode, 403);
        assert.equal(err.email, "charlie@example.com");
        return true;
      }
    );
  });

  it("5. Invalid OTP attempt increments attempt count and reports remaining attempts", async () => {
    await authService.registerUser({
      name: "David Test",
      email: "david@example.com",
      password: "password123",
      role: "patient",
    });

    await assert.rejects(
      async () => {
        await authService.verifyPatientOTP("david@example.com", "000000");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /4 attempts remaining/i);
        return true;
      }
    );

    const record = await otpRepo.findLatestByEmail("david@example.com");
    assert.equal(record?.attempts, 1);
  });

  it("6. Five failed attempts invalidates the OTP completely", async () => {
    await authService.registerUser({
      name: "Eve Test",
      email: "eve@example.com",
      password: "password123",
      role: "patient",
    });

    // Fail 4 times
    for (let i = 0; i < 4; i++) {
      await assert.rejects(async () => {
        await authService.verifyPatientOTP("eve@example.com", "111111");
      });
    }

    // 5th failure invalidates
    await assert.rejects(
      async () => {
        await authService.verifyPatientOTP("eve@example.com", "111111");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /Maximum verification attempts exceeded/i);
        return true;
      }
    );

    // The OTP record should be deleted/invalidated
    const record = await otpRepo.findLatestByEmail("eve@example.com");
    assert.equal(record, null, "Exceeded OTP must be deleted from active lookup");
  });

  it("7. Expired OTP (>10 minutes) is rejected", async () => {
    await authService.registerUser({
      name: "Frank Expired",
      email: "frank@example.com",
      password: "password123",
      role: "patient",
    });

    const record = await otpRepo.findLatestByEmail("frank@example.com");
    assert.ok(record);

    // Simulate expiration by winding expiresAt back 11 minutes
    record.expiresAt = new Date(Date.now() - 11 * 60 * 1000);
    const itemInStore = otpRepo.records.find((r) => r.email === "frank@example.com");
    itemInStore.expiresAt = record.expiresAt;

    await assert.rejects(
      async () => {
        await authService.verifyPatientOTP("frank@example.com", "123456");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /expired/i);
        return true;
      }
    );
  });

  it("8. Resend OTP enforces 60-second cooldown", async () => {
    await authService.registerUser({
      name: "Grace Cooldown",
      email: "grace@example.com",
      password: "password123",
      role: "patient",
    });

    // Immediate resend must fail with cooldown error
    await assert.rejects(
      async () => {
        await authService.resendPatientOTP("grace@example.com");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        assert.match(err.message, /Please wait \d+ seconds before requesting a new OTP/i);
        return true;
      }
    );
  });

  it("9. Resending OTP after cooldown invalidates previous code and sends a fresh one", async () => {
    await authService.registerUser({
      name: "Henry Resend",
      email: "henry@example.com",
      password: "password123",
      role: "patient",
    });

    const firstPlainOtp = emailService.sentEmails[0].text?.match(/\b\d{6}\b/)?.[0] || "";

    // Fast-forward createdAt beyond 60 seconds
    const record = otpRepo.records.find((r) => r.email === "henry@example.com");
    record.createdAt = new Date(Date.now() - 65 * 1000);

    const resendResult = await authService.resendPatientOTP("henry@example.com");
    assert.equal(resendResult.success, true);
    assert.equal(emailService.sentEmails.length, 2);

    const secondPlainOtp = emailService.sentEmails[1].text?.match(/\b\d{6}\b/)?.[0] || "";

    // Old OTP must now be rejected because previous OTP was invalidated
    await assert.rejects(
      async () => {
        await authService.verifyPatientOTP("henry@example.com", firstPlainOtp);
      }
    );

    // New OTP must verify successfully
    const verifyResult = await authService.verifyPatientOTP("henry@example.com", secondPlainOtp);
    assert.ok(verifyResult.token);
  });

  it("10. Re-registering with an unverified email updates credentials and resends OTP without duplicate users", async () => {
    // 1st attempt
    await authService.registerUser({
      name: "Ian Original",
      email: "ian@example.com",
      password: "password123",
      role: "patient",
    });

    assert.equal(userRepo.users.length, 1);

    // Fast-forward cooldown
    const record = otpRepo.records.find((r) => r.email === "ian@example.com");
    record.createdAt = new Date(Date.now() - 65 * 1000);

    // 2nd attempt with updated name
    const reRegisterResult = await authService.registerUser({
      name: "Ian Updated",
      email: "ian@example.com",
      password: "newPassword456",
      role: "patient",
    });

    assert.equal(reRegisterResult.requiresEmailVerification, true);
    assert.equal(userRepo.users.length, 1, "Should NOT create duplicate user record");

    const updatedUser = await userRepo.findByEmail("ian@example.com");
    assert.equal(updatedUser?.name, "Ian Updated");
  });

  it("11. Re-registering with an already-verified email throws ConflictError", async () => {
    await authService.registerUser({
      name: "Jack Patient",
      email: "jack@example.com",
      password: "password123",
      role: "patient",
    });

    const plainOtp = emailService.sentEmails[0].text?.match(/\b\d{6}\b/)?.[0] || "";
    await authService.verifyPatientOTP("jack@example.com", plainOtp);

    // Now try to register again
    await assert.rejects(
      async () => {
        await authService.registerUser({
          name: "Jack Duplicate",
          email: "jack@example.com",
          password: "anotherPassword",
          role: "patient",
        });
      },
      (err: any) => err instanceof ConflictError
    );
  });

  it("12. Google Login automatically sets isEmailVerified to true and sends no OTP emails", async () => {
    const mockGoogleAuth = {
      async verifyIdToken(_credential: string) {
        return {
          googleId: "google_12345",
          email: "google.patient@example.com",
          name: "Google Patient",
        };
      },
    };

    const roleReg = new RoleHandlerRegistry();
    roleReg.register("patient", new PatientRoleHandler(patientRepo as any));

    const googleAuthService = new AuthService(
      userRepo as any,
      new MockPasswordHasher(),
      new MockTokenService(),
      roleReg,
      mockGoogleAuth as any,
      otpService,
    );

    const result = await googleAuthService.loginPatientWithGoogle("fake_google_credential");
    assert.ok(result.token);
    assert.equal(result.user.email, "google.patient@example.com");

    const user = await userRepo.findByEmail("google.patient@example.com");
    assert.equal(user?.isEmailVerified, true);
    assert.ok(user?.emailVerifiedAt);

    // No OTP emails should be sent
    assert.equal(emailService.sentEmails.length, 0);
  });

  it("13. Doctor and Admin logins bypass patient OTP verification entirely", async () => {
    const mockDoctorRepo = {
      async findByUserId(_userId: any) {
        return { active: true, verificationStatus: "verified" };
      },
    };

    const roleReg = new RoleHandlerRegistry();
    roleReg.register("doctor", new DoctorRoleHandler(mockDoctorRepo as any));

    const doctorAuthService = new AuthService(
      userRepo as any,
      new MockPasswordHasher(),
      new MockTokenService(),
      roleReg,
      undefined,
      otpService,
    );

    await userRepo.create({
      name: "Dr. Gregory House",
      email: "house@example.com",
      password: "hashed_vicodin123",
      role: "doctor",
      isEmailVerified: true,
    });

    const loginResult = await doctorAuthService.loginUser({
      email: "house@example.com",
      password: "vicodin123",
    });

    assert.ok(loginResult.token);
    assert.equal(loginResult.user.role, "doctor");
  });
});

