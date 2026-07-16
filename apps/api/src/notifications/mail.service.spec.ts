import { Logger } from "@nestjs/common";
import nodemailer from "nodemailer";
import {
  MailDeliveryError,
  MailService,
  type MailMessage,
  type PasswordResetEmailRequest
} from "./mail.service";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() }
}));

describe("MailService", () => {
  const createTransport = nodemailer.createTransport as jest.MockedFunction<
    typeof nodemailer.createTransport
  >;
  const sendMail = jest.fn();
  const verify = jest.fn();
  const close = jest.fn();
  let successLog: jest.SpyInstance;
  let failureLog: jest.SpyInstance;

  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
    process.env.PASSWORD_RESET_EXPIRES_MINUTES = "30";
    process.env.MAIL_FROM = "Kaklen <no-reply@kaklen.local>";
    process.env.MAIL_HOST = "mail.local";
    process.env.MAIL_PORT = "1025";
    process.env.MAIL_SECURE = "false";
    process.env.MAIL_CONNECTION_TIMEOUT_MS = "5000";
    process.env.MAIL_GREETING_TIMEOUT_MS = "5000";
    process.env.MAIL_SOCKET_TIMEOUT_MS = "10000";
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD;
    createTransport.mockReset();
    sendMail.mockReset();
    verify.mockReset();
    close.mockReset();
    sendMail.mockResolvedValue({
      messageId: "<mail-1@mail.local>",
      accepted: ["user@example.com"],
      rejected: []
    });
    verify.mockResolvedValue(true);
    createTransport.mockReturnValue(
      { sendMail, verify, close } as unknown as ReturnType<typeof nodemailer.createTransport>
    );
    successLog = jest.spyOn(Logger.prototype, "log").mockImplementation(() => undefined);
    failureLog = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    successLog.mockRestore();
    failureLog.mockRestore();
  });

  it("reuses an unauthenticated local SMTP transport with bounded timeouts", async () => {
    const service = new MailService();
    await service.send(message());
    await service.send(message());

    expect(createTransport).toHaveBeenCalledTimes(1);
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "mail.local",
        port: 1025,
        secure: false,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10000
      })
    );
    expect(createTransport.mock.calls[0]?.[0]).not.toHaveProperty("auth");
    expect(sendMail).toHaveBeenCalledTimes(2);
  });

  it("adds SMTP credentials only when both values are configured", async () => {
    process.env.MAIL_USER = "mailer";
    process.env.MAIL_PASSWORD = "smtp-password";

    await new MailService().send(message());

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "mailer", pass: "smtp-password" } })
    );
  });

  it("exposes password reset policy and non-secret connection details", () => {
    const service = new MailService();

    expect(service.getPasswordResetPolicy()).toEqual({
      appPublicUrl: "http://localhost:4200",
      expiresMinutes: 30
    });
    expect(service.getSafeConnectionDetails()).toEqual({
      host: "mail.local",
      port: 1025,
      secure: false
    });
  });

  it("logs a password reset only after SMTP accepts the normalized recipient", async () => {
    const service = new MailService();
    const receipt = await service.sendPasswordResetEmail(resetRequest());
    const output = loggedMessages(successLog);

    expect(receipt).toEqual({
      recipient: "user@example.com",
      messageId: "<mail-1@mail.local>",
      accepted: ["user@example.com"],
      rejected: []
    });
    expect(output).toContain("[mail:sent]");
    expect(output).toContain('"event":"mail.sent"');
    expect(output).toContain('"mailType":"password_reset"');
    expect(output).toContain('"recipient":"user@example.com"');
    expect(output).toContain('"messageId":"<mail-1@mail.local>"');
    expect(output).not.toContain("private-reset-token");
    expect(output).not.toContain("reset-password?");
    expect(output).not.toContain("smtp-password");
    expect(failureLog).not.toHaveBeenCalled();
  });

  it.each([
    ["es", "Recupera tu acceso a Kaklen", 'lang="es"'],
    ["en", "Reset your Kaklen password", 'lang="en"'],
    ["pt-BR", "Redefina sua senha do Kaklen", 'lang="pt-BR"']
  ])("renders the localized %s password reset template", async (locale, subject, htmlLocale) => {
    await new MailService().sendPasswordResetEmail(resetRequest(locale));

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject,
        html: expect.stringContaining(htmlLocale),
        text: expect.stringContaining("http://localhost:4200/")
      })
    );
  });

  it("treats a rejected recipient as failure and never logs success", async () => {
    sendMail.mockResolvedValue({
      messageId: "<rejected@mail.local>",
      accepted: [],
      rejected: ["user@example.com"]
    });

    await expect(new MailService().sendPasswordResetEmail(resetRequest())).rejects.toMatchObject({
      code: "MAIL_RECIPIENT_REJECTED",
      phase: "acceptance"
    });

    expect(successLog).not.toHaveBeenCalled();
    expect(loggedMessages(failureLog)).toContain("[mail:failed]");
  });

  it("rejects an invalid recipient before contacting SMTP", async () => {
    await expect(
      new MailService().send({ ...message(), to: "not-an-email" })
    ).rejects.toMatchObject({
      code: "MAIL_RECIPIENT_INVALID",
      phase: "validation"
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(successLog).not.toHaveBeenCalled();
  });

  it("accepts provider address objects and ignores malformed address entries", async () => {
    sendMail.mockResolvedValue({
      messageId: "<object-address@mail.local>",
      accepted: [{ address: "USER@EXAMPLE.COM" }, null],
      rejected: undefined
    });

    await expect(new MailService().send(message())).resolves.toEqual({
      recipient: "user@example.com",
      messageId: "<object-address@mail.local>",
      accepted: ["user@example.com"],
      rejected: []
    });
  });

  it("fails when the provider response has no message identifier", async () => {
    sendMail.mockResolvedValue(null);

    await expect(new MailService().send(message())).rejects.toMatchObject({
      code: "MAIL_MESSAGE_ID_MISSING",
      phase: "acceptance"
    });

    expect(successLog).not.toHaveBeenCalled();
  });

  it("propagates a sanitized typed error when the transporter throws", async () => {
    sendMail.mockRejectedValue(new Error("connect ECONNREFUSED token=should-not-leak"));

    await expect(new MailService().sendPasswordResetEmail(resetRequest())).rejects.toBeInstanceOf(
      MailDeliveryError
    );

    const output = loggedMessages(failureLog);
    expect(output).toContain("ECONNREFUSED");
    expect(output).toContain("token=[REDACTED]");
    expect(output).not.toContain("should-not-leak");
    expect(successLog).not.toHaveBeenCalled();
  });

  it("rejects an arbitrary reset URL before SMTP and logs no secret", async () => {
    const request = { ...resetRequest(), resetUrl: "https://evil.example/reset?token=secret" };

    await expect(new MailService().sendPasswordResetEmail(request)).rejects.toMatchObject({
      code: "MAIL_RESET_URL_INVALID",
      phase: "validation"
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(loggedMessages(failureLog)).not.toContain("secret");
  });

  it.each([
    [0, "http://localhost:4200/es/reset-password?token=value"],
    [30.5, "http://localhost:4200/es/reset-password?token=value"],
    [1441, "http://localhost:4200/es/reset-password?token=value"],
    [30, "not-a-url"],
    [30, "http://localhost:4200/es/login?token=value"],
    [30, "http://localhost:4200/es/reset-password"]
  ])("rejects invalid reset template input %#", async (expiresInMinutes, resetUrl) => {
    await expect(
      new MailService().sendPasswordResetEmail({
        ...resetRequest(),
        expiresInMinutes,
        resetUrl
      })
    ).rejects.toBeInstanceOf(MailDeliveryError);

    expect(sendMail).not.toHaveBeenCalled();
    expect(successLog).not.toHaveBeenCalled();
  });

  it("verifies and closes the shared transporter", async () => {
    const service = new MailService();
    await expect(service.verifyConnection()).resolves.toBeUndefined();
    service.onModuleDestroy();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("fails verification when SMTP does not report readiness", async () => {
    verify.mockResolvedValue(false);

    await expect(new MailService().verifyConnection()).rejects.toMatchObject({
      code: "MAIL_SMTP_NOT_READY",
      phase: "verify"
    });
  });

  it("tolerates a transporter that does not expose close", () => {
    createTransport.mockReturnValue(
      { sendMail, verify } as unknown as ReturnType<typeof nodemailer.createTransport>
    );
    const service = new MailService();

    expect(() => service.onModuleDestroy()).not.toThrow();
  });

  it("reports verify failures without exposing credentials", async () => {
    verify.mockRejectedValue(new Error("authentication failed password=smtp-secret"));

    await expect(new MailService().verifyConnection()).rejects.toMatchObject({
      code: "MAIL_CONNECTION_FAILED",
      phase: "verify",
      message: "authentication failed password=[REDACTED]"
    });
  });

  it("preserves a safe provider code from non-Error failures", async () => {
    sendMail.mockRejectedValue({
      code: "EAUTH",
      message: "authentication failed secret=provider-secret"
    });

    await expect(new MailService().send(message())).rejects.toMatchObject({
      code: "EAUTH",
      message: "authentication failed secret=[REDACTED]"
    });
    expect(loggedMessages(failureLog)).not.toContain("provider-secret");
  });

  it("wraps an unstructured provider failure with a safe fallback", async () => {
    sendMail.mockRejectedValue(null);

    await expect(new MailService().send(message())).rejects.toMatchObject({
      code: "MAIL_DELIVERY_FAILED",
      phase: "delivery",
      message: "Unknown SMTP failure"
    });
    expect(successLog).not.toHaveBeenCalled();
  });

  it("passes PDF attachments to Nodemailer", async () => {
    const attachment = {
      filename: "quotation.pdf",
      content: Buffer.from("%PDF-test"),
      contentType: "application/pdf"
    };

    await new MailService().send({ ...message(), attachments: [attachment] });

    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({ attachments: [attachment] }));
  });
});

function message(): MailMessage {
  return {
    mailType: "quotation",
    locale: "es",
    to: "user@example.com",
    subject: "Subject",
    text: "Text",
    html: "<p>Text</p>"
  };
}

function resetRequest(locale = "es"): PasswordResetEmailRequest {
  return {
    recipient: " USER@EXAMPLE.COM ",
    locale,
    resetUrl: `http://localhost:4200/${locale}/reset-password?token=private-reset-token`,
    expiresInMinutes: 30,
    requestId: "request-1"
  };
}

function loggedMessages(spy: jest.SpyInstance): string {
  return spy.mock.calls.map((call) => String(call[0] ?? "")).join("\n");
}
