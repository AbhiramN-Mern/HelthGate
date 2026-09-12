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

  clear(): void {
    this.sentEmails = [];
    this.shouldFail = false;
  }
}
