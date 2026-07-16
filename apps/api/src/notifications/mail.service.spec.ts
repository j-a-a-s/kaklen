import nodemailer from "nodemailer";
import { MailService } from "./mail.service";

jest.mock("nodemailer", () => ({
  __esModule: true,
  default: { createTransport: jest.fn() }
}));

describe("MailService", () => {
  const createTransport = nodemailer.createTransport as jest.MockedFunction<
    typeof nodemailer.createTransport
  >;
  const sendMail = jest.fn(async () => ({ messageId: "mail-1" }));

  beforeEach(() => {
    process.env.MAIL_FROM = "Kaklen <no-reply@kaklen.local>";
    process.env.MAIL_HOST = "mail.local";
    process.env.MAIL_PORT = "1025";
    process.env.MAIL_SECURE = "false";
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD;
    createTransport.mockReset();
    sendMail.mockClear();
    createTransport.mockReturnValue({ sendMail } as unknown as ReturnType<typeof nodemailer.createTransport>);
  });

  it("sends through an unauthenticated local SMTP transport", async () => {
    await new MailService().send(message());

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: "mail.local", port: 1025, secure: false })
    );
    expect(createTransport.mock.calls[0]?.[0]).not.toHaveProperty("auth");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ from: "Kaklen <no-reply@kaklen.local>", to: "user@example.com" })
    );
  });

  it("adds SMTP credentials only when both values are configured", async () => {
    process.env.MAIL_USER = "mailer";
    process.env.MAIL_PASSWORD = "smtp-password";

    await new MailService().send(message());

    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({ auth: { user: "mailer", pass: "smtp-password" } })
    );
  });
});

function message(): { to: string; subject: string; text: string; html: string } {
  return {
    to: "user@example.com",
    subject: "Subject",
    text: "Text",
    html: "<p>Text</p>"
  };
}
