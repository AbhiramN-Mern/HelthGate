import { IPatientRepository } from "../repositories/interfaces/IPatientRepository.js";
import { INotificationRepository } from "../repositories/interfaces/INotificationRepository.js";
import { BadRequestError, NotFoundError } from "../core/errors/AppError.js";

const patientUpdateFields = [
  "dateOfBirth",
  "gender",
  "phone",
  "address",
  "profileImage",
  "bloodGroup",
  "allergies",
  "medicalHistory",
] as const;

export class PatientService {
  constructor(
    private patientRepo: IPatientRepository,
    private notificationRepo: INotificationRepository,
  ) {}

  private pickPatientUpdates(body: Record<string, unknown>) {
    return Object.fromEntries(
      patientUpdateFields
        .filter((field) => body[field] !== undefined)
        .map((field) => [field, body[field]]),
    );
  }

  async getMyPatientProfile(userId: string) {
    const patient = await this.patientRepo.findByUserId(userId, true);
    if (!patient) {
      throw new NotFoundError("Patient profile not found");
    }
    return patient;
  }

  async updateMyPatientProfile(userId: string, body: Record<string, unknown>) {
    const updates = this.pickPatientUpdates(body);

    if (updates.dateOfBirth) {
      const dob = new Date(updates.dateOfBirth as string);
      if (isNaN(dob.getTime()) || dob > new Date()) {
        throw new BadRequestError("Date of birth cannot be in the future");
      }
    }

    const patient = await this.patientRepo.updateByUserId(userId, updates);
    if (!patient) {
      throw new NotFoundError("Patient profile not found");
    }

    return patient;
  }

  async getPatientNotifications(userId: string) {
    return this.notificationRepo.findByRecipient(userId, 30);
  }

  async markPatientNotificationRead(notificationId: string, userId: string) {
    return this.notificationRepo.markAsRead(notificationId, userId);
  }
}
