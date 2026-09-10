import { IRoleHandler } from "../IRoleHandler.js";
import { IAdminRepository } from "../../../repositories/interfaces/IAdminRepository.js";

export class AdminRoleHandler implements IRoleHandler {
  constructor(private adminRepo: IAdminRepository) {}

  validateRegistrationProfile(_profile: Record<string, unknown>): void {
    // Admin has no specific required sub-fields
  }

  async createProfile(userId: string, profile: Record<string, unknown>): Promise<any> {
    return this.adminRepo.create({ ...profile, user: userId });
  }

  async validateLoginStatus(_userId: string): Promise<void> {
    // Admins do not have secondary deactivation toggles at this stage
  }
}
