import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { AuthService } from "../services/auth.service.js";
import { AdminService } from "../services/admin.service.js";
import { OTPService } from "../services/otp.service.js";
import { RoleHandlerRegistry } from "../core/auth/handlers/RoleHandlerRegistry.js";
import { DoctorRoleHandler } from "../core/auth/handlers/DoctorRoleHandler.js";
import { PatientRoleHandler } from "../core/auth/handlers/PatientRoleHandler.js";
import { AdminRoleHandler } from "../core/auth/handlers/AdminRoleHandler.js";
import { MockEmailService } from "../infrastructure/email/MockEmailService.js";
import { IOTPRepository, OTPDocument } from "../repositories/interfaces/IOTPRepository.js";
import { BadRequestError, ConflictError, EmailVerificationRequiredError, ForbiddenError } from "../core/errors/AppError.js";

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

  async create(userData: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      isEmailVerified: userData.isEmailVerified ?? false,
      emailVerifiedAt: userData.emailVerifiedAt ?? null,
      ...userData,
    };
    this.users.push(doc);
    return { ...doc };
  }

  async findByEmail(email: string, _includePassword = false) {
    const user = this.users.find((u) => u.email === email.toLowerCase().trim());
    return user ? { ...user } : null;
  }

  async findById(id: any) {
    const user = this.users.find((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    return user ? { ...user } : null;
  }

  async update(id: any, updates: any) {
    const idx = this.users.findIndex((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    if (idx !== -1) {
      this.users[idx] = { ...this.users[idx], ...updates };
      return { ...this.users[idx] };
    }
    return null;
  }

  async findByIdAndDelete(id: any) {
    this.users = this.users.filter((u) => u.id !== id.toString() && u._id?.toString() !== id.toString());
  }
}

// In-memory Doctor Repository
class MockDoctorRepo {
  public doctors: any[] = [];

  async create(doctorData: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      active: true,
      verificationStatus: doctorData.verificationStatus || "pending",
      doctorApprovalStatus: doctorData.doctorApprovalStatus || "pending",
      isEmailVerified: doctorData.isEmailVerified ?? false,
      ...doctorData,
    };
    this.doctors.push(doc);
    return { ...doc };
  }

  async findByUserId(userId: any, _populate = true) {
    const doc = this.doctors.find((d) => d.user?.toString() === userId.toString());
    return doc ? { ...doc } : null;
  }

  async findById(id: any, _populate = true) {
    const doc = this.doctors.find((d) => d.id === id.toString() || d._id?.toString() === id.toString());
    return doc ? { ...doc } : null;
  }

  async updateById(id: any, updates: any) {
    const idx = this.doctors.findIndex((d) => d.id === id.toString() || d._id?.toString() === id.toString());
    if (idx !== -1) {
      this.doctors[idx] = { ...this.doctors[idx], ...updates };
      return { ...this.doctors[idx] };
    }
    return null;
  }

  async updateByUserId(userId: any, updates: any) {
    const idx = this.doctors.findIndex((d) => d.user?.toString() === userId.toString());
    if (idx !== -1) {
      this.doctors[idx] = { ...this.doctors[idx], ...updates };
      return { ...this.doctors[idx] };
    }
    return null;
  }
}

class MockPasswordHasher {
  async hash(pw: string) {
    return `hashed_${pw}`;
  }
  async compare(plain: string, hashed: string) {
    return hashed === `hashed_${plain}`;
  }
}

class MockTokenService {
  generateToken(payload: any, _expiresIn?: string): string {
    return `mock.jwt.token.${payload.id}.${payload.role}`;
  }
  verifyToken(token: string): any {
    const parts = token.split(".");
    return { id: parts[3] || "mock_id", role: parts[4] || "doctor" };
  }
}

describe("HelthGate Doctor Verification Flow Tests", () => {
  let userRepo: MockUserRepo;
  let doctorRepo: MockDoctorRepo;
  let otpRepo: MockOTPRepo;
  let emailService: MockEmailService;
  let otpService: OTPService;
  let authService: AuthService;
  let adminService: AdminService;
  let roleRegistry: RoleHandlerRegistry;

  beforeEach(() => {
    userRepo = new MockUserRepo();
    doctorRepo = new MockDoctorRepo();
    otpRepo = new MockOTPRepo();
    emailService = new MockEmailService();
    otpService = new OTPService(otpRepo as any, emailService);

    roleRegistry = new RoleHandlerRegistry();
    roleRegistry.register("patient", new PatientRoleHandler({ create: async () => ({}) } as any));
    roleRegistry.register("doctor", new DoctorRoleHandler(doctorRepo as any));
    roleRegistry.register("admin", new AdminRoleHandler({} as any));

    authService = new AuthService(
      userRepo as any,
      new MockPasswordHasher(),
      new MockTokenService(),
      roleRegistry,
      undefined,
      otpService,
      doctorRepo as any,
    );

    adminService = new AdminService(
      userRepo as any,
      {} as any,
      doctorRepo as any,
      {} as any,
      {} as any,
      {} as any,
      { create: async () => ({}) } as any,
      {} as any,
      {} as any,
    );
  });

  it("1. Doctor registration creates unverified user and pending doctor profile, and sends OTP", async () => {
    const regResult = await authService.registerUser({
      name: "Dr. Sarah Strange",
      email: "sarah.strange@hospital.org",
      password: "DoctorPassword123!",
      role: "doctor",
      profile: {
        specialization: "Neurology",
        qualification: "MD, PhD",
        licenseNumber: "MED-NEURO-8890",
      },
    });

    assert.equal(regResult.requiresEmailVerification, true);
    assert.equal(regResult.email, "sarah.strange@hospital.org");
    assert.equal((regResult as any).token, undefined); // Token is NOT provided until verified

    const userInDb = await userRepo.findByEmail("sarah.strange@hospital.org");
    assert.ok(userInDb);
    assert.equal(userInDb.isEmailVerified, false);
    assert.equal(userInDb.role, "doctor");

    const doctorProfile = await doctorRepo.findByUserId(userInDb.id);
    assert.ok(doctorProfile);
    assert.equal(doctorProfile.doctorApprovalStatus, "pending");
    assert.equal(doctorProfile.verificationStatus, "pending");
    assert.equal(doctorProfile.isEmailVerified, false);

    assert.equal(emailService.sentEmails.length, 1);
    assert.equal(emailService.sentEmails[0].to, "sarah.strange@hospital.org");
    assert.match(emailService.sentEmails[0].subject, /Verify Your Email/i);
  });

  it("2. Doctor login before email verification is rejected with EmailVerificationRequiredError", async () => {
    await authService.registerUser({
      name: "Dr. Gregory House",
      email: "house@diagnostics.org",
      password: "VicodinPassword123!",
      role: "doctor",
      profile: {
        specialization: "Diagnostics",
        qualification: "MD",
        licenseNumber: "LIC-HOUSE-100",
      },
    });

    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: "house@diagnostics.org",
          password: "VicodinPassword123!",
        });
      },
      (err: any) => {
        assert.ok(err instanceof EmailVerificationRequiredError);
        assert.equal(err.email, "house@diagnostics.org");
        assert.equal(err.code, "EMAIL_NOT_VERIFIED");
        return true;
      },
    );
  });

  it("3. Valid OTP verification marks doctor email as verified and returns doctorApprovalStatus: 'pending'", async () => {
    await authService.registerUser({
      name: "Dr. Lisa Cuddy",
      email: "cuddy@princeton.org",
      password: "DeanPassword123!",
      role: "doctor",
      profile: {
        specialization: "Endocrinology",
        qualification: "MD",
        licenseNumber: "LIC-CUDDY-200",
      },
    });

    const sentEmail = emailService.sentEmails.find((e) => e.to === "cuddy@princeton.org");
    assert.ok(sentEmail);
    const otpMatch = sentEmail.html.match(/\b\d{6}\b/);
    assert.ok(otpMatch);
    const otp = otpMatch[0];

    const verifyResult = await authService.verifyPatientOTP("cuddy@princeton.org", otp);

    assert.ok(verifyResult.token);
    assert.equal(verifyResult.user.isEmailVerified, true);
    assert.equal((verifyResult.user as any).doctorApprovalStatus, "pending");

    const user = await userRepo.findByEmail("cuddy@princeton.org");
    assert.equal(user?.isEmailVerified, true);

    const docProfile = await doctorRepo.findByUserId(user?.id);
    assert.equal(docProfile?.isEmailVerified, true);
    assert.equal(docProfile?.doctorApprovalStatus, "pending");
  });

  it("4. Doctor login after email verification returns pending approval status", async () => {
    await authService.registerUser({
      name: "Dr. Eric Foreman",
      email: "foreman@hospital.org",
      password: "ForemanPassword123!",
      role: "doctor",
      profile: {
        specialization: "Neurology",
        qualification: "MD",
        licenseNumber: "LIC-FOREMAN-300",
      },
    });

    const sentEmail = emailService.sentEmails.find((e) => e.to === "foreman@hospital.org");
    const otp = sentEmail!.html.match(/\b\d{6}\b/)![0];
    await authService.verifyPatientOTP("foreman@hospital.org", otp);

    const loginResult = await authService.loginUser({
      email: "foreman@hospital.org",
      password: "ForemanPassword123!",
    });

    assert.ok(loginResult.token);
    assert.equal(loginResult.user.role, "doctor");
    assert.equal(loginResult.user.isEmailVerified, true);
    assert.equal((loginResult.user as any).doctorApprovalStatus, "pending");
  });

  it("5. Admin approves doctor -> sets doctorApprovalStatus: 'approved' and verificationStatus: 'verified'", async () => {
    await authService.registerUser({
      name: "Dr. James Wilson",
      email: "wilson@oncology.org",
      password: "WilsonPassword123!",
      role: "doctor",
      profile: {
        specialization: "Oncology",
        qualification: "MD",
        licenseNumber: "LIC-WILSON-400",
      },
    });

    const user = await userRepo.findByEmail("wilson@oncology.org");
    const doctor = await doctorRepo.findByUserId(user?.id);

    const approvedDoc = await adminService.verifyDoctor(doctor.id);
    assert.equal(approvedDoc.doctorApprovalStatus, "approved");
    assert.equal(approvedDoc.verificationStatus, "verified");
    assert.equal(approvedDoc.active, true);
  });

  it("6. Admin rejects doctor -> sets doctorApprovalStatus: 'rejected' and blocks doctor login", async () => {
    await authService.registerUser({
      name: "Dr. Robert Chase",
      email: "chase@surgery.org",
      password: "ChasePassword123!",
      role: "doctor",
      profile: {
        specialization: "Surgeon",
        qualification: "MBBS, MD",
        licenseNumber: "LIC-CHASE-500",
      },
    });

    const sentEmail = emailService.sentEmails.find((e) => e.to === "chase@surgery.org");
    const otp = sentEmail!.html.match(/\b\d{6}\b/)![0];
    await authService.verifyPatientOTP("chase@surgery.org", otp);

    const user = await userRepo.findByEmail("chase@surgery.org");
    const doctor = await doctorRepo.findByUserId(user?.id);

    await adminService.rejectDoctor(doctor.id, "Invalid credentials provided");

    const rejectedDoctor = await doctorRepo.findById(doctor.id);
    assert.equal(rejectedDoctor.doctorApprovalStatus, "rejected");
    assert.equal(rejectedDoctor.verificationStatus, "rejected");

    await assert.rejects(
      async () => {
        await authService.loginUser({
          email: "chase@surgery.org",
          password: "ChasePassword123!",
        });
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError);
        assert.match(err.message, /rejected/i);
        return true;
      },
    );
  });

  it("7. Re-registering with an unverified doctor email updates credentials and resends OTP", async () => {
    await authService.registerUser({
      name: "Dr. Allison Cameron",
      email: "cameron@immunology.org",
      password: "FirstPassword123!",
      role: "doctor",
      profile: {
        specialization: "Immunology",
        qualification: "MD",
        licenseNumber: "LIC-CAMERON-600",
      },
    });

    assert.equal(emailService.sentEmails.length, 1);

    // Simulate cooldown passing by setting existing OTP createdAt back 65 seconds
    otpRepo.records[0].createdAt = new Date(Date.now() - 65 * 1000);

    // Re-register before verifying email
    const reReg = await authService.registerUser({
      name: "Dr. Allison Cameron-Chase",
      email: "cameron@immunology.org",
      password: "NewPassword123!",
      role: "doctor",
      profile: {
        specialization: "Immunology & Allergy",
        qualification: "MD",
        licenseNumber: "LIC-CAMERON-600",
      },
    });

    assert.equal(reReg.requiresEmailVerification, true);
    assert.equal(emailService.sentEmails.length, 2);

    // No duplicate user
    assert.equal(userRepo.users.filter((u) => u.email === "cameron@immunology.org").length, 1);
  });

  it("8. Re-registering with an already-verified doctor email throws ConflictError", async () => {
    await authService.registerUser({
      name: "Dr. Chris Taub",
      email: "taub@plastics.org",
      password: "TaubPassword123!",
      role: "doctor",
      profile: {
        specialization: "Plastic Surgery",
        qualification: "MD",
        licenseNumber: "LIC-TAUB-700",
      },
    });

    const otp = emailService.sentEmails[0].html.match(/\b\d{6}\b/)![0];
    await authService.verifyPatientOTP("taub@plastics.org", otp);

    await assert.rejects(
      async () => {
        await authService.registerUser({
          name: "Dr. Chris Taub Clone",
          email: "taub@plastics.org",
          password: "AnotherPassword123!",
          role: "doctor",
          profile: {
            specialization: "Plastic Surgery",
            qualification: "MD",
            licenseNumber: "LIC-TAUB-700",
          },
        });
      },
      (err: any) => {
        assert.ok(err instanceof ConflictError);
        assert.match(err.message, /already registered/i);
        return true;
      },
    );
  });
});
