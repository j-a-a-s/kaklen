import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { MailDeliveryError, MailService } from "../src/notifications/mail.service";

const workspaceRoot = resolve(__dirname, "../../..");
const envPath = resolve(workspaceRoot, ".env");
if (existsSync(envPath)) {
  process.loadEnvFile(envPath);
}

async function main(): Promise<void> {
  let mailService: MailService;
  try {
    mailService = new MailService();
  } catch (error) {
    fail(error);
  }

  try {
    await mailService.verifyConnection();
    const details = mailService.getSafeConnectionDetails();
    console.log("MAIL SMTP READY");
    console.log(`Host: ${details.host}`);
    console.log(`Port: ${details.port}`);
    console.log(`Secure: ${details.secure}`);
  } catch (error) {
    fail(error);
  } finally {
    mailService.onModuleDestroy();
  }
}

function fail(error: unknown): never {
  const cause =
    error instanceof MailDeliveryError || error instanceof Error
      ? sanitize(error.message)
      : "No fue posible verificar el servidor SMTP.";
  console.error("MAIL SMTP UNAVAILABLE");
  console.error(`Cause: ${cause}`);
  process.exit(1);
}

function sanitize(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, " ")
    .replace(/https?:\/\/\S+/gi, "[URL]")
    .replace(/(password|pass|token|secret)=\S+/gi, "$1=[REDACTED]")
    .trim();
}

void main();
