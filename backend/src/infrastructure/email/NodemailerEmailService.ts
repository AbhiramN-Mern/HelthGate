import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import type { IEmailService, SendEmailOptions, EmailSendResult } from "./IEmailService.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class NodemailerEmailService implements IEmailService {
  private transporter: Transporter | null = null;
  private defaultFrom: string;

  constructor() {
    this.defaultFrom =
      process.env.EMAIL_FROM ||
      process.env.EMAIL_USER ||
      `"HealthGate Medical System" <noreply@healthgate.com>`;

    this.initializeTransporter();
  }

  private initializeTransporter() {
    const host = process.env.EMAIL_HOST;
    const port = Number(process.env.EMAIL_PORT) || 587;
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    if (!host || !user || !pass) {
      console.warn(
        "[NodemailerEmailService] SMTP credentials not fully provided in environment. Outbound emails will be skipped safely.",
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465, // true for 465, false for other ports (e.g. 587 with STARTTLS)
        auth: {
          user,
          pass,
        },
      });
      console.log(`[NodemailerEmailService] Initialized SMTP transporter for host: ${host}:${port}`);
    } catch (err) {
      console.error("[NodemailerEmailService] Failed to initialize SMTP transporter:", err);
      this.transporter = null;
    }
  }

  async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const { to, subject, html, text, from } = options;

    if (!to || !EMAIL_REGEX.test(to.trim())) {
      console.warn(`[NodemailerEmailService] Invalid recipient email provided: "${to}". Skipping send.`);
      return {
        success: false,
        error: `Invalid recipient email address: "${to}"`,
      };
    }

    if (!this.transporter) {
      // Re-try transporter initialization in case env changed or was delayed
      this.initializeTransporter();
      if (!this.transporter) {
        console.warn("[NodemailerEmailService] SMTP transporter unavailable. Cannot send email.");
        return {
          success: false,
          error: "SMTP transporter is not configured or unavailable",
        };
      }
    }

    try {
      const info = await this.transporter.sendMail({
        from: from || this.defaultFrom,
        to: to.trim(),
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ""), // simple fallback text
      });

      console.log(`[NodemailerEmailService] Email sent successfully to ${to}. MessageId: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (err: any) {
      console.error(`[NodemailerEmailService] Failed to send email to ${to}:`, err.message || err);
      return {
        success: false,
        error: err.message || "Failed to send email via SMTP",
      };
    }
  }
}
