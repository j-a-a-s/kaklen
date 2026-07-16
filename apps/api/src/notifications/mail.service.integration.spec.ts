import { createServer, type Server, type Socket } from "node:net";
import { MailService } from "./mail.service";

type SmtpMode = "accept" | "reject" | "silent";

describe("MailService SMTP integration", () => {
  const servers: Server[] = [];
  const sockets = new Set<Socket>();

  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
    process.env.PASSWORD_RESET_EXPIRES_MINUTES = "30";
    process.env.MAIL_FROM = "Kaklen <no-reply@kaklen.local>";
    process.env.MAIL_HOST = "127.0.0.1";
    process.env.MAIL_SECURE = "false";
    process.env.MAIL_CONNECTION_TIMEOUT_MS = "500";
    process.env.MAIL_GREETING_TIMEOUT_MS = "500";
    process.env.MAIL_SOCKET_TIMEOUT_MS = "1000";
    delete process.env.MAIL_USER;
    delete process.env.MAIL_PASSWORD;
  });

  afterEach(async () => {
    sockets.forEach((socket) => socket.destroy());
    sockets.clear();
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve) => {
            server.close(() => resolve());
          })
      )
    );
  });

  it("delivers through a real SMTP conversation and returns provider evidence", async () => {
    const port = await startSmtpServer("accept", servers, sockets);
    process.env.MAIL_PORT = String(port);
    const service = new MailService();

    const receipt = await service.sendPasswordResetEmail(request());

    expect(receipt.recipient).toBe("integration@example.com");
    expect(receipt.accepted).toEqual(["integration@example.com"]);
    expect(receipt.rejected).toEqual([]);
    expect(receipt.messageId).toMatch(/^<.+>$/);
    service.onModuleDestroy();
  });

  it("fails when the SMTP server rejects the recipient", async () => {
    const port = await startSmtpServer("reject", servers, sockets);
    process.env.MAIL_PORT = String(port);
    const service = new MailService();

    await expect(service.sendPasswordResetEmail(request())).rejects.toMatchObject({
      code: expect.stringMatching(/EENVELOPE|MAIL_RECIPIENT_REJECTED/)
    });
    service.onModuleDestroy();
  });

  it("fails when the SMTP connection is unavailable", async () => {
    const unavailablePort = await reserveClosedPort();
    process.env.MAIL_PORT = String(unavailablePort);
    const service = new MailService();

    await expect(service.sendPasswordResetEmail(request())).rejects.toMatchObject({
      code: "ESOCKET"
    });
    service.onModuleDestroy();
  });

  it("fails on an SMTP greeting timeout", async () => {
    const port = await startSmtpServer("silent", servers, sockets);
    process.env.MAIL_PORT = String(port);
    process.env.MAIL_GREETING_TIMEOUT_MS = "100";
    process.env.MAIL_SOCKET_TIMEOUT_MS = "200";
    const service = new MailService();

    await expect(service.sendPasswordResetEmail(request())).rejects.toMatchObject({
      code: "ETIMEDOUT"
    });
    service.onModuleDestroy();
  });

  it("rejects invalid template input before opening an SMTP connection", async () => {
    const port = await startSmtpServer("accept", servers, sockets);
    process.env.MAIL_PORT = String(port);
    const service = new MailService();

    await expect(
      service.sendPasswordResetEmail({
        ...request(),
        resetUrl: "https://untrusted.example/reset-password?token=private-value"
      })
    ).rejects.toMatchObject({
      code: "MAIL_RESET_URL_INVALID",
      phase: "validation"
    });
    expect(sockets.size).toBe(0);
    service.onModuleDestroy();
  });
});

function request(): {
  recipient: string;
  locale: "es";
  resetUrl: string;
  expiresInMinutes: number;
} {
  return {
    recipient: "integration@example.com",
    locale: "es",
    resetUrl: "http://localhost:4200/es/reset-password?token=integration-token-value",
    expiresInMinutes: 30
  };
}

async function startSmtpServer(
  mode: SmtpMode,
  servers: Server[],
  sockets: Set<Socket>
): Promise<number> {
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    if (mode === "silent") {
      return;
    }

    socket.setEncoding("utf8");
    socket.write("220 smtp.test ESMTP ready\r\n");
    let buffer = "";
    let readingData = false;
    socket.on("data", (chunk: string) => {
      buffer += chunk;
      let lineEnd = buffer.indexOf("\r\n");
      while (lineEnd >= 0) {
        const line = buffer.slice(0, lineEnd);
        buffer = buffer.slice(lineEnd + 2);
        if (readingData) {
          if (line === ".") {
            readingData = false;
            socket.write("250 2.0.0 queued as integration-message\r\n");
          }
        } else if (/^(EHLO|HELO)\b/i.test(line)) {
          socket.write("250-smtp.test\r\n250 PIPELINING\r\n");
        } else if (/^MAIL FROM:/i.test(line)) {
          socket.write("250 2.1.0 sender accepted\r\n");
        } else if (/^RCPT TO:/i.test(line)) {
          socket.write(
            mode === "reject"
              ? "550 5.1.1 recipient rejected\r\n"
              : "250 2.1.5 recipient accepted\r\n"
          );
        } else if (/^DATA$/i.test(line)) {
          readingData = true;
          socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
        } else if (/^RSET$/i.test(line) || /^NOOP$/i.test(line)) {
          socket.write("250 2.0.0 ok\r\n");
        } else if (/^QUIT$/i.test(line)) {
          socket.end("221 2.0.0 bye\r\n");
        }
        lineEnd = buffer.indexOf("\r\n");
      }
    });
  });
  servers.push(server);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("SMTP integration server did not expose a TCP port");
  }
  return address.port;
}

async function reserveClosedPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not reserve a TCP port");
  }
  const port = address.port;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return port;
}
