import type { IEmailService, SendEmailOptions, EmailSendResult } from "./IEmailService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class MockEmailService implements IEmailService {
  public sentEmails: SendEmailOptions[] = [];
  public shouldFail = false;
  public failureErrorMessage = "Simulated SMTP connection error";

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const { to } = options;

    if (!to || !EMAIL_REGEX.test(to.trim())) {
      return {
        success: false,
        error: `Invalid recipient email address: "${to}"`,
      };
    }

    if (this.shouldFail) {
      return {
        success: false,
        error: this.failureErrorMessage,
      };
    }

    const messageId = `mock_msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    this.sentEmails.push({ ...options });

    return {
      success: true,
      messageId,
    };
  }

  async sendVerificationOTP(email: string, otp: string): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: "Verify Your Email - HelthGate Hospital Management",
      html: `<p>Your verification code is: <strong>${otp}</strong></p>`,
      text: `Your verification code is: ${otp}`,
    });
  }

  async sendPasswordResetOTP(email: string, otp: string): Promise<EmailSendResult> {
    return this.sendEmail({
      to: email,
      subject: "Reset Your Password - HelthGate Hospital Management",
      html: `<p>Your password reset code is: <strong>${otp}</strong></p>`,
      text: `Your password reset code is: ${otp}`,
    });
  }

  clear(): void {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}

