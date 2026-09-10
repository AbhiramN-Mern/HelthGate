import { IRoleHandler } from "../IRoleHandler.js";
import { IDoctorRepository } from "../../../repositories/interfaces/IDoctorRepository.js";
import { BadRequestError, ForbiddenError } from "../../errors/AppError.js";

export class DoctorRoleHandler implements IRoleHandler {
  constructor(private doctorRepo: IDoctorRepository) {}

  validateRegistrationProfile(profile: Record<string, unknown>): void {
    const requiredFields = ["specialization", "qualification", "licenseNumber"];
    const missing = requiredFields.filter((f) => !profile[f]);

    if (missing.length > 0) {
      throw new BadRequestError(
        "Doctor profile requires specialization, qualification, and licenseNumber",
      );
    }
  }

  async createProfile(userId: string, profile: Record<string, unknown>): Promise<any> {
    return this.doctorRepo.create({ ...profile, user: userId as any });
  }

  async validateLoginStatus(userId: string): Promise<void> {
    const doctorProfile = await this.doctorRepo.findByUserId(userId, false);
    if (!doctorProfile) {
      throw new ForbiddenError("Doctor profile not found. Please contact admin.");
    }
    if (!doctorProfile.active) {
      throw new ForbiddenError("Doctor account is deactivated by admin");
    }
    if (doctorProfile.verificationStatus === "pending") {
      throw new ForbiddenError("Doctor account is pending admin verification");
    }
    if (doctorProfile.verificationStatus === "rejected") {
      throw new ForbiddenError("Doctor account was rejected by admin");
    }
  }
}
