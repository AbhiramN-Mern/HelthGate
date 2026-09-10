export interface IRoleHandler {
  validateRegistrationProfile(profile: Record<string, unknown>): void;
  createProfile(userId: string, profile: Record<string, unknown>): Promise<any>;
  validateLoginStatus(userId: string): Promise<void>;
}
