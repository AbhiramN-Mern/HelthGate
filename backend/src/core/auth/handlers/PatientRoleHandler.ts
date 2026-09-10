import { IRoleHandler } from "../IRoleHandler.js";
import { IPatientRepository } from "../../../repositories/interfaces/IPatientRepository.js";
import { ForbiddenError } from "../../errors/AppError.js";

export class PatientRoleHandler implements IRoleHandler {
  constructor(private patientRepo: IPatientRepository) {}

  validateRegistrationProfile(_profile: Record<string, unknown>): void {
    // Patient profile has no strictly required sub-fields on registration
  }

  async createProfile(userId: string, profile: Record<string, unknown>): Promise<any> {
    return this.patientRepo.create({ ...profile, user: userId as any });
  }

  async validateLoginStatus(userId: string): Promise<void> {
    const patientProfile = await this.patientRepo.findByUserId(userId);
    if (!patientProfile) {
      throw new ForbiddenError("Patient profile not found. Please contact admin.");
    }
    if (!patientProfile.active) {
      throw new ForbiddenError("Patient account is blocked by admin");
    }
  }
}
