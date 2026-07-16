import { Injectable } from "@nestjs/common";
import nodemailer from "nodemailer";
import { readPasswordRecoveryConfig } from "@kaklen/config";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

@Injectable()
export class MailService {
  async send(message: MailMessage): Promise<void> {
    const config = readPasswordRecoveryConfig(process.env);
    const transport = nodemailer.createTransport({
      host: config.mailHost,
      port: config.mailPort,
      secure: config.mailSecure,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      ...(config.mailUser && config.mailPassword
        ? { auth: { user: config.mailUser, pass: config.mailPassword } }
        : {})
    });

    await transport.sendMail({
      from: config.mailFrom,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html
    });
  }
}
