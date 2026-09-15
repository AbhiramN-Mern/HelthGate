import crypto from "crypto";
import { IOTPRepository } from "../repositories/interfaces/IOTPRepository.js";
import { IEmailService } from "../infrastructure/email/IEmailService.js";
import { BadRequestError } from "../core/errors/AppError.js";

export class OTPService {
  private readonly OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
  private readonly RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
  private readonly MAX_ATTEMPTS = 5;

  constructor(
    private otpRepo: IOTPRepository,
    private emailService: IEmailService,
  ) {}

  /**
   * Generates a cryptographically secure 6-digit numeric OTP.
   */
  private generateNumericOTP(): string {
    return crypto.randomInt(100000, 1000000).toString();
  }

  /**
   * Hashes the plaintext OTP using SHA-256 for secure database storage.
   */
  public hashOTP(otp: string): string {
    return crypto.createHash("sha256").update(otp.trim()).digest("hex");
  }

  /**
   * Generates, stores, and sends an OTP to the given email.
   * Enforces a 60-second cooldown from the previous active OTP.
   */
  async generateAndSendOTP(email: string): Promise<{ success: boolean; cooldownSeconds: number }> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new BadRequestError("Please provide a valid email address");
    }

    // Check for active OTP and enforce 60-second resend cooldown
    const existingOtp = await this.otpRepo.findLatestByEmail(normalizedEmail);
    if (existingOtp && existingOtp.createdAt) {
      const elapsed = Date.now() - new Date(existingOtp.createdAt).getTime();
      if (elapsed < this.RESEND_COOLDOWN_MS) {
        const remainingSeconds = Math.ceil((this.RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new BadRequestError(
          `Please wait ${remainingSeconds} seconds before requesting a new OTP.`,
        );
      }
    }

    // Invalidate/delete previous OTPs for this email to prevent replay
    await this.otpRepo.deleteByEmail(normalizedEmail);

    // Generate cryptographic 6-digit OTP and calculate expiry
    const plainOtp = this.generateNumericOTP();
    const otpHash = this.hashOTP(plainOtp);
    const expiresAt = new Date(Date.now() + this.OTP_EXPIRY_MS);

    // Persist hashed OTP
    await this.otpRepo.create({
      email: normalizedEmail,
      otpHash,
      expiresAt,
    });

    // Dispatch OTP via Email Service
    const emailResult = this.emailService.sendVerificationOTP
      ? await this.emailService.sendVerificationOTP(normalizedEmail, plainOtp)
      : await this.emailService.sendEmail({
          to: normalizedEmail,
          subject: "Verify Your Email - HelthGate Hospital Management",
          html: `<p>Your verification code is: <strong>${plainOtp}</strong></p>`,
          text: `Your verification code is: ${plainOtp}`,
        });
    if (!emailResult.success) {
      console.warn(`[OTPService] Outbound email warning for ${normalizedEmail}: ${emailResult.error}`);
    }

    return {
      success: true,
      cooldownSeconds: Math.floor(this.RESEND_COOLDOWN_MS / 1000),
    };
  }

  /**
   * Verifies the provided OTP for the given email.
   * Enforces expiration, attempt limits, and marks OTP as used upon success.
   */
  async verifyOTP(email: string, candidateOtp: string): Promise<boolean> {
    const normalizedEmail = email.toLowerCase().trim();

    if (!candidateOtp || typeof candidateOtp !== "string" || !candidateOtp.trim()) {
      throw new BadRequestError("Verification code is required");
    }

    const cleanCandidate = candidateOtp.trim();
    if (!/^\d{6}$/.test(cleanCandidate)) {
      throw new BadRequestError("Verification code must be a 6-digit number");
    }

    const otpRecord = await this.otpRepo.findLatestByEmail(normalizedEmail);
    if (!otpRecord) {
      throw new BadRequestError("No active verification code found for this email. Please request a new code.");
    }

    // Check if already used
    if (otpRecord.usedAt) {
      throw new BadRequestError("This verification code has already been used. Please request a new code.");
    }

    // Check if max attempts already exceeded
    if (otpRecord.attempts >= this.MAX_ATTEMPTS) {
      await this.otpRepo.deleteById(otpRecord.id || (otpRecord as any)._id);
      throw new BadRequestError("Maximum verification attempts exceeded. Please request a new code.");
    }

    // Check expiration (10 minutes)
    if (Date.now() > new Date(otpRecord.expiresAt).getTime()) {
      await this.otpRepo.deleteById(otpRecord.id || (otpRecord as any)._id);
      throw new BadRequestError("Verification code has expired. Please request a new code.");
    }

    // Validate hash
    const candidateHash = this.hashOTP(cleanCandidate);
    if (candidateHash !== otpRecord.otpHash) {
      // Increment attempt counter
      const updated = await this.otpRepo.incrementAttempts(otpRecord.id || (otpRecord as any)._id);
      const attemptsMade = updated ? updated.attempts : otpRecord.attempts + 1;
      const remainingAttempts = Math.max(0, this.MAX_ATTEMPTS - attemptsMade);

      if (remainingAttempts === 0) {
        await this.otpRepo.deleteById(otpRecord.id || (otpRecord as any)._id);
        throw new BadRequestError("Maximum verification attempts exceeded. Please request a new code.");
      }

      throw new BadRequestError(`Invalid verification code. You have ${remainingAttempts} attempt${remainingAttempts === 1 ? "" : "s"} remaining.`);
    }

    // Mark as used
    await this.otpRepo.markAsUsed(otpRecord.id || (otpRecord as any)._id);
    return true;
  }
}
