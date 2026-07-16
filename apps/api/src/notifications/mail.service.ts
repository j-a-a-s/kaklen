import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { readPasswordRecoveryConfig } from "@kaklen/config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

export interface MailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

@Injectable()
export class MailService {
  private readonly config = readPasswordRecoveryConfig(process.env);

  async send(message: MailMessage): Promise<void> {
    const transport = nodemailer.createTransport({
      host: this.config.mailHost,
      port: this.config.mailPort,
      secure: this.config.mailSecure,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      ...(this.config.mailUser && this.config.mailPassword
        ? { auth: { user: this.config.mailUser, pass: this.config.mailPassword } }
        : {})
    });

    await transport.sendMail({
      from: this.config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
      attachments: message.attachments
    });
  }
}
