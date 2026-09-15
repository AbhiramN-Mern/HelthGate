import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { Types } from "mongoose";
import { AuthService } from "../services/auth.service.js";
import { RoleHandlerRegistry } from "../core/auth/handlers/RoleHandlerRegistry.js";
import { PatientRoleHandler } from "../core/auth/handlers/PatientRoleHandler.js";
import { DoctorRoleHandler } from "../core/auth/handlers/DoctorRoleHandler.js";
import { AdminRoleHandler } from "../core/auth/handlers/AdminRoleHandler.js";
import { IGoogleAuthService, VerifiedGoogleUser } from "../infrastructure/security/GoogleAuthService.js";
import { BadRequestError, ForbiddenError, UnauthorizedError } from "../core/errors/AppError.js";

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
    return `mock_jwt_token_${payload.id}_${payload.role}`;
  }
  verifyToken(token: string): any {
    const parts = token.split("_");
    return { id: parts[3], role: parts[4] };
  }
}

// In-memory User Repository
class MockUserRepo {
  public users: any[] = [];

  async findByEmail(email: string, _selectPassword = false) {
    const found = this.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
    return found ? { ...found } : null;
  }

  async findById(id: any) {
    const found = this.users.find((u) => u.id === id.toString() || u._id?.toString() === id.toString());
    return found ? { ...found } : null;
  }

  async findByGoogleId(googleId: string) {
    const found = this.users.find((u) => u.googleId === googleId);
    return found ? { ...found } : null;
  }

  async create(userData: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      authProvider: userData.authProvider || "local",
      ...userData,
    };
    this.users.push(doc);
    return { ...doc };
  }

  async update(id: any, update: any) {
    const index = this.users.findIndex(
      (u) => u.id === id.toString() || u._id?.toString() === id.toString()
    );
    if (index === -1) return null;
    this.users[index] = { ...this.users[index], ...update };
    return { ...this.users[index] };
  }

  async findAll() {
    return [...this.users];
  }

  async find(filter: any = {}) {
    return this.users.filter((u) => {
      for (const k of Object.keys(filter)) {
        if (u[k] !== filter[k]) return false;
      }
      return true;
    });
  }

  async count() {
    return this.users.length;
  }

  async findByIdAndDelete(id: any) {
    const idx = this.users.findIndex(
      (u) => u.id === id.toString() || u._id?.toString() === id.toString()
    );
    if (idx !== -1) {
      const removed = this.users.splice(idx, 1);
      return removed[0];
    }
    return null;
  }
}

// In-memory Patient Repository
class MockPatientRepo {
  public patients: any[] = [];

  async create(data: any) {
    const doc = {
      _id: new Types.ObjectId(),
      id: new Types.ObjectId().toString(),
      active: true,
      ...data,
    };
    this.patients.push(doc);
    return doc;
  }

  async findByUserId(userId: string) {
    const found = this.patients.find(
      (p) => p.user?.toString() === userId.toString() || p.user === userId
    );
    return found || null;
  }
}

// In-memory Doctor Repository
class MockDoctorRepo {
  public doctors: any[] = [];

  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), active: true, verificationStatus: "verified", ...data };
    this.doctors.push(doc);
    return doc;
  }

  async findByUserId(userId: string) {
    const found = this.doctors.find((d) => d.user?.toString() === userId.toString());
    return found || null;
  }
}

// In-memory Admin Repository
class MockAdminRepo {
  public admins: any[] = [];

  async create(data: any) {
    const doc = { _id: new Types.ObjectId(), active: true, ...data };
    this.admins.push(doc);
    return doc;
  }

  async findByUserId(userId: string) {
    const found = this.admins.find((a) => a.user?.toString() === userId.toString());
    return found || null;
  }
}

// Mock Google Auth Service
class MockGoogleAuthService implements IGoogleAuthService {
  public mockUsers: Map<string, VerifiedGoogleUser> = new Map();

  async verifyIdToken(idToken: string): Promise<VerifiedGoogleUser> {
    if (!idToken || !idToken.trim()) {
      throw new BadRequestError("Google credential is required");
    }

    if (idToken === "invalid_token" || idToken === "expired_token") {
      throw new UnauthorizedError("Invalid or expired Google token");
    }

    if (this.mockUsers.has(idToken)) {
      const user = this.mockUsers.get(idToken)!;
      if (!user.email) {
        throw new BadRequestError("Google account has no associated email address");
      }
      if (!user.emailVerified) {
        throw new BadRequestError("Google email address is not verified");
      }
      return user;
    }

    // Default mock response
    return {
      googleId: "google_sub_default_123",
      email: "googlepatient@example.com",
      emailVerified: true,
      name: "Google Patient",
      picture: "https://lh3.googleusercontent.com/a/default-avatar",
    };
  }
}

describe("Patient-Only Google Login & Registration Tests", () => {
  function setupTestEnvironment() {
    const userRepo = new MockUserRepo();
    const patientRepo = new MockPatientRepo();
    const doctorRepo = new MockDoctorRepo();
    const adminRepo = new MockAdminRepo();
    const passwordHasher = new MockPasswordHasher();
    const tokenService = new MockTokenService();
    const googleAuthService = new MockGoogleAuthService();

    const roleRegistry = new RoleHandlerRegistry();
    roleRegistry.register("patient", new PatientRoleHandler(patientRepo as any));
    roleRegistry.register("doctor", new DoctorRoleHandler(doctorRepo as any));
    roleRegistry.register("admin", new AdminRoleHandler(adminRepo as any));

    const authService = new AuthService(
      userRepo as any,
      passwordHasher as any,
      tokenService as any,
      roleRegistry,
      googleAuthService as any
    );

    return {
      userRepo,
      patientRepo,
      doctorRepo,
      adminRepo,
      googleAuthService,
      authService,
    };
  }

  it("1. New patient -> Google Login -> creates Patient user and Patient profile", async () => {
    const { authService, userRepo, patientRepo, googleAuthService } = setupTestEnvironment();

    googleAuthService.mockUsers.set("new_patient_token", {
      googleId: "google_sub_001",
      email: "newpatient@gmail.com",
      emailVerified: true,
      name: "Sarah Connor",
      picture: "https://lh3.googleusercontent.com/sarah.jpg",
    });

    const result = await authService.loginPatientWithGoogle("new_patient_token");

    assert.ok(result.token, "JWT token must be returned");
    assert.equal(result.user.role, "patient");
    assert.equal(result.user.email, "newpatient@gmail.com");
    assert.equal(result.user.name, "Sarah Connor");
    assert.equal(result.user.authProvider, "google");

    // Check userRepo persisted
    const savedUser = await userRepo.findByEmail("newpatient@gmail.com");
    assert.ok(savedUser, "User record must exist");
    assert.equal(savedUser.googleId, "google_sub_001");
    assert.equal(savedUser.role, "patient");
    assert.equal(savedUser.authProvider, "google");

    // Check patient profile created
    const profile = await patientRepo.findByUserId(savedUser.id);
    assert.ok(profile, "Patient profile must be created");
    assert.equal(profile.profileImage, "https://lh3.googleusercontent.com/sarah.jpg");
    assert.equal(profile.active, true);
  });

  it("2. Existing Google patient -> Google Login -> logs in existing patient without duplicate records", async () => {
    const { authService, userRepo, patientRepo, googleAuthService } = setupTestEnvironment();

    // Register user first
    googleAuthService.mockUsers.set("existing_patient_token", {
      googleId: "google_sub_002",
      email: "existingpatient@gmail.com",
      emailVerified: true,
      name: "John Doe",
    });

    const firstLogin = await authService.loginPatientWithGoogle("existing_patient_token");
    const secondLogin = await authService.loginPatientWithGoogle("existing_patient_token");

    assert.equal(firstLogin.user.id, secondLogin.user.id);
    assert.equal(userRepo.users.length, 1, "Must NOT create duplicate user records");
    assert.equal(patientRepo.patients.length, 1, "Must NOT create duplicate patient profile records");
  });

  it("3. Existing email/password patient -> Google Login with same email -> safely links Google ID", async () => {
    const { authService, userRepo, patientRepo, googleAuthService } = setupTestEnvironment();

    // Patient originally registered via email/password
    const localPatientUser = await userRepo.create({
      name: "Alice Local",
      email: "alice@example.com",
      role: "patient",
      authProvider: "local",
    });
    await patientRepo.create({ user: localPatientUser.id, active: true });

    // Patient now signs in with Google with same verified email
    googleAuthService.mockUsers.set("alice_google_token", {
      googleId: "google_sub_alice_123",
      email: "alice@example.com",
      emailVerified: true,
      name: "Alice Google",
    });

    const result = await authService.loginPatientWithGoogle("alice_google_token");

    assert.equal(result.user.id, localPatientUser.id, "Must log in to the existing patient account");
    assert.equal(userRepo.users.length, 1, "Must not create duplicate user");
    assert.equal(patientRepo.patients.length, 1, "Must not create duplicate patient profile");

    // Check account linking
    const updatedUser = await userRepo.findById(localPatientUser.id);
    assert.equal(updatedUser?.googleId, "google_sub_alice_123", "Must safely link Google ID");
  });

  it("4. Doctor account with same email -> Google Login -> strictly rejected with ForbiddenError", async () => {
    const { authService, userRepo, doctorRepo, googleAuthService } = setupTestEnvironment();

    // Existing doctor account
    const doctorUser = await userRepo.create({
      name: "Dr. House",
      email: "doctor.house@hospital.com",
      role: "doctor",
      authProvider: "local",
    });
    await doctorRepo.create({ user: doctorUser.id, active: true, verificationStatus: "verified" });

    // Attempt Google Login with doctor email
    googleAuthService.mockUsers.set("doctor_google_token", {
      googleId: "google_sub_doctor_999",
      email: "doctor.house@hospital.com",
      emailVerified: true,
      name: "Dr. House",
    });

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("doctor_google_token");
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Must throw ForbiddenError");
        assert.match(err.message, /doctor/i);
        assert.match(err.message, /only available for patient accounts/i);
        return true;
      }
    );

    // Ensure role did not change
    const checkUser = await userRepo.findById(doctorUser.id);
    assert.equal(checkUser?.role, "doctor", "Doctor role must remain unchanged");
  });

  it("5. Admin account with same email -> Google Login -> strictly rejected with ForbiddenError", async () => {
    const { authService, userRepo, adminRepo, googleAuthService } = setupTestEnvironment();

    // Existing admin account
    const adminUser = await userRepo.create({
      name: "Super Admin",
      email: "admin@helthgate.com",
      role: "admin",
      authProvider: "local",
    });
    await adminRepo.create({ user: adminUser.id, active: true });

    googleAuthService.mockUsers.set("admin_google_token", {
      googleId: "google_sub_admin_888",
      email: "admin@helthgate.com",
      emailVerified: true,
      name: "Super Admin",
    });

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("admin_google_token");
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Must throw ForbiddenError");
        assert.match(err.message, /admin/i);
        return true;
      }
    );

    const checkUser = await userRepo.findById(adminUser.id);
    assert.equal(checkUser?.role, "admin", "Admin role must remain unchanged");
  });

  it("6. Invalid or expired Google credential -> rejected with UnauthorizedError", async () => {
    const { authService } = setupTestEnvironment();

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("invalid_token");
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedError, "Must reject invalid token");
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("expired_token");
      },
      (err: any) => {
        assert.ok(err instanceof UnauthorizedError, "Must reject expired token");
        return true;
      }
    );
  });

  it("7. Missing or unverified Google email -> rejected with BadRequestError", async () => {
    const { authService, googleAuthService } = setupTestEnvironment();

    // Missing email
    googleAuthService.mockUsers.set("no_email_token", {
      googleId: "sub_no_email",
      email: "",
      emailVerified: true,
      name: "No Email User",
    });

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("no_email_token");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError, "Must reject missing email");
        return true;
      }
    );

    // Unverified email
    googleAuthService.mockUsers.set("unverified_email_token", {
      googleId: "sub_unverified",
      email: "unverified@gmail.com",
      emailVerified: false,
      name: "Unverified User",
    });

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("unverified_email_token");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError, "Must reject unverified email");
        return true;
      }
    );
  });

  it("8. Empty or missing credential token -> rejected with BadRequestError", async () => {
    const { authService } = setupTestEnvironment();

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("");
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        return true;
      }
    );

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle(undefined as any);
      },
      (err: any) => {
        assert.ok(err instanceof BadRequestError);
        return true;
      }
    );
  });

  it("9. Blocked/inactive patient account attempting Google Login -> rejected with ForbiddenError", async () => {
    const { authService, userRepo, patientRepo, googleAuthService } = setupTestEnvironment();

    // Blocked patient user
    const blockedUser = await userRepo.create({
      name: "Blocked Patient",
      email: "blocked@patient.com",
      role: "patient",
      authProvider: "google",
      googleId: "google_blocked_1",
    });
    // active: false
    await patientRepo.create({ user: blockedUser.id, active: false });

    googleAuthService.mockUsers.set("blocked_google_token", {
      googleId: "google_blocked_1",
      email: "blocked@patient.com",
      emailVerified: true,
      name: "Blocked Patient",
    });

    await assert.rejects(
      async () => {
        await authService.loginPatientWithGoogle("blocked_google_token");
      },
      (err: any) => {
        assert.ok(err instanceof ForbiddenError, "Must throw ForbiddenError");
        assert.match(err.message, /blocked by admin/i);
        return true;
      }
    );
  });
});
