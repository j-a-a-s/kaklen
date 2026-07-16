import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
import { isEmail } from "class-validator";
import nodemailer from "nodemailer";
import { readPasswordRecoveryConfig, type PasswordRecoveryConfig } from "@kaklen/config";
import {
  normalizeNotificationLocale,
  renderPasswordResetEmail,
  type NotificationLocale
} from "./templates";

export type MailType = "password_reset" | "quotation";

export interface MailMessage {
  mailType: MailType;
  locale: NotificationLocale;
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
  requestId?: string;
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

export interface PasswordResetEmailRequest {
  recipient: string;
  locale: string | null | undefined;
  resetUrl: string;
  expiresInMinutes: number;
  requestId?: string;
}

export interface MailDeliveryReceipt {
  recipient: string;
  messageId: string;
  accepted: string[];
  rejected: string[];
}

export interface SafeMailConnectionDetails {
  host: string;
  port: number;
  secure: boolean;
}

export class MailDeliveryError extends Error {
  constructor(
    readonly code: string,
    readonly phase: "validation" | "connection" | "delivery" | "acceptance" | "verify",
    message: string
  ) {
    super(message);
    this.name = "MailDeliveryError";
  }
}

@Injectable()
export class MailService implements OnModuleDestroy {
  private readonly logger = new Logger(MailService.name);
  private readonly config: PasswordRecoveryConfig;
  private readonly transporter: ReturnType<typeof nodemailer.createTransport>;

  constructor() {
    this.config = readPasswordRecoveryConfig(process.env);
    this.transporter = nodemailer.createTransport({
      host: this.config.mailHost,
      port: this.config.mailPort,
      secure: this.config.mailSecure,
      connectionTimeout: this.config.mailConnectionTimeoutMs,
      greetingTimeout: this.config.mailGreetingTimeoutMs,
      socketTimeout: this.config.mailSocketTimeoutMs,
      ...(this.config.mailUser && this.config.mailPassword
        ? { auth: { user: this.config.mailUser, pass: this.config.mailPassword } }
        : {})
    });
  }

  getPasswordResetPolicy(): { appPublicUrl: string; expiresMinutes: number } {
    return {
      appPublicUrl: this.config.appPublicUrl,
      expiresMinutes: this.config.expiresMinutes
    };
  }

  getSafeConnectionDetails(): SafeMailConnectionDetails {
    return {
      host: this.config.mailHost,
      port: this.config.mailPort,
      secure: this.config.mailSecure
    };
  }

  async verifyConnection(): Promise<void> {
    try {
      const ready = await this.transporter.verify();
      if (!ready) {
        throw new MailDeliveryError(
          "MAIL_SMTP_NOT_READY",
          "verify",
          "SMTP server did not confirm readiness"
        );
      }
    } catch (error) {
      throw this.toDeliveryError(error, "MAIL_CONNECTION_FAILED", "verify");
    }
  }

  async sendPasswordResetEmail(
    request: PasswordResetEmailRequest
  ): Promise<MailDeliveryReceipt> {
    const locale = normalizeNotificationLocale(request.locale);
    let content: ReturnType<typeof renderPasswordResetEmail>;
    try {
      this.assertPasswordResetRequest(request, locale);
      content = renderPasswordResetEmail(locale, {
        resetUrl: request.resetUrl,
        expiresMinutes: request.expiresInMinutes
      });
    } catch (error) {
      const deliveryError = this.toDeliveryError(
        error,
        "MAIL_TEMPLATE_FAILED",
        "validation"
      );
      this.logFailure(
        {
          mailType: "password_reset",
          locale,
          to: request.recipient,
          subject: "",
          text: "",
          html: "",
          ...(request.requestId ? { requestId: request.requestId } : {})
        },
        normalizeRecipient(request.recipient),
        deliveryError
      );
      throw deliveryError;
    }

    return this.send({
      mailType: "password_reset",
      locale,
      to: request.recipient,
      subject: content.subject,
      text: content.text,
      html: content.html,
      ...(request.requestId ? { requestId: request.requestId } : {})
    });
  }

  async send(message: MailMessage): Promise<MailDeliveryReceipt> {
    const recipient = normalizeRecipient(message.to);
    try {
      if (!isEmail(recipient)) {
        throw new MailDeliveryError(
          "MAIL_RECIPIENT_INVALID",
          "validation",
          "Recipient email address is invalid"
        );
      }

      const providerResult: unknown = await this.transporter.sendMail({
        from: this.config.mailFrom,
        to: recipient,
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: message.attachments
      });
      const receipt = this.readReceipt(providerResult, recipient);
      this.logSuccess(message, receipt);
      return receipt;
    } catch (error) {
      const deliveryError = this.toDeliveryError(error, "MAIL_DELIVERY_FAILED", "delivery");
      this.logFailure(message, recipient, deliveryError);
      throw deliveryError;
    }
  }

  onModuleDestroy(): void {
    if (typeof this.transporter.close === "function") {
      this.transporter.close();
    }
  }

  private assertPasswordResetRequest(
    request: PasswordResetEmailRequest,
    locale: NotificationLocale
  ): void {
    if (
      !Number.isInteger(request.expiresInMinutes) ||
      request.expiresInMinutes <= 0 ||
      request.expiresInMinutes > 1440
    ) {
      throw new MailDeliveryError(
        "MAIL_TEMPLATE_INPUT_INVALID",
        "validation",
        "Password reset expiration is invalid"
      );
    }

    let resetUrl: URL;
    try {
      resetUrl = new URL(request.resetUrl);
    } catch {
      throw new MailDeliveryError(
        "MAIL_RESET_URL_INVALID",
        "validation",
        "Password reset URL is invalid"
      );
    }
    const configuredUrl = new URL(this.config.appPublicUrl);
    if (
      resetUrl.origin !== configuredUrl.origin ||
      resetUrl.pathname !== `/${locale}/reset-password` ||
      !resetUrl.searchParams.get("token")
    ) {
      throw new MailDeliveryError(
        "MAIL_RESET_URL_INVALID",
        "validation",
        "Password reset URL does not match the configured application"
      );
    }
  }

  private readReceipt(result: unknown, recipient: string): MailDeliveryReceipt {
    const record = isRecord(result) ? result : {};
    const messageId = sanitizeLogValue(
      typeof record.messageId === "string" ? record.messageId : ""
    );
    const accepted = providerAddresses(record.accepted);
    const rejected = providerAddresses(record.rejected);
    if (!messageId) {
      throw new MailDeliveryError(
        "MAIL_MESSAGE_ID_MISSING",
        "acceptance",
        "SMTP provider did not return a message identifier"
      );
    }
    if (!accepted.includes(recipient) || rejected.includes(recipient)) {
      throw new MailDeliveryError(
        "MAIL_RECIPIENT_REJECTED",
        "acceptance",
        "SMTP provider did not accept the recipient"
      );
    }
    return { recipient, messageId, accepted, rejected };
  }

  private logSuccess(message: MailMessage, receipt: MailDeliveryReceipt): void {
    const entry = {
      event: "mail.sent",
      result: "success",
      mailType: message.mailType,
      recipient: receipt.recipient,
      locale: message.locale,
      messageId: receipt.messageId,
      accepted: receipt.accepted,
      rejected: receipt.rejected,
      timestamp: new Date().toISOString(),
      ...(message.requestId ? { requestId: sanitizeLogValue(message.requestId) } : {})
    };
    this.logger.log(`[mail:sent] ${JSON.stringify(entry)}`);
  }

  private logFailure(
    message: MailMessage,
    recipient: string,
    error: MailDeliveryError
  ): void {
    const entry = {
      event: "mail.failed",
      result: "failure",
      mailType: message.mailType,
      recipient,
      locale: message.locale,
      code: error.code,
      phase: error.phase,
      cause: sanitizeLogValue(error.message),
      timestamp: new Date().toISOString(),
      ...(message.requestId ? { requestId: sanitizeLogValue(message.requestId) } : {})
    };
    this.logger.error(`[mail:failed] ${JSON.stringify(entry)}`);
  }

  private toDeliveryError(
    error: unknown,
    fallbackCode: string,
    fallbackPhase: MailDeliveryError["phase"]
  ): MailDeliveryError {
    if (error instanceof MailDeliveryError) {
      return error;
    }
    const record = isRecord(error) ? error : {};
    const providerCode = typeof record.code === "string" ? record.code : fallbackCode;
    const rawMessage =
      error instanceof Error
        ? error.message
        : typeof record.message === "string"
          ? record.message
          : "Unknown SMTP failure";
    const message = sanitizeLogValue(rawMessage);
    return new MailDeliveryError(providerCode, fallbackPhase, message || "Unknown SMTP failure");
  }
}

function normalizeRecipient(value: string): string {
  return sanitizeLogValue(value).trim().toLowerCase();
}

function providerAddresses(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => {
      if (typeof entry === "string") {
        return normalizeRecipient(entry);
      }
      if (isRecord(entry) && typeof entry.address === "string") {
        return normalizeRecipient(entry.address);
      }
      return "";
    })
    .filter((entry) => entry.length > 0);
}

function sanitizeLogValue(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/(password|pass|token|secret)=\S+/gi, "$1=[REDACTED]")
    .trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
