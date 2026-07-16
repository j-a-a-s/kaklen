import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const demoEmail = "empresa.angela@demo.kaklen.local";
const demoPassword = "KaklenDemo2026!";

test.describe.serial("secure password recovery with real Mailpit delivery", () => {
  test.setTimeout(180_000);

  let api;
  let mailpit;
  let prisma;
  let genericResponse;
  let temporaryPassword;
  let passwordChanged = false;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Origin: "http://localhost:4200" }
    });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    prisma = new PrismaClient();
    temporaryPassword = `Recovered-${Date.now()}!`;
    await clearMailpit(mailpit);
  });

  test.afterAll(async () => {
    if (passwordChanged) {
      await restoreDemoPassword(api, mailpit);
    }
    await clearMailpit(mailpit);
    await prisma?.$disconnect();
    await api?.dispose();
    await mailpit?.dispose();
  });

  test("delivers one localized email, resets the demo password, and rejects token reuse", async ({ page }) => {
    const originalLogin = await api.post("/api/auth/login", {
      data: { email: demoEmail, password: demoPassword }
    });
    expect(originalLogin.status()).toBe(200);
    const originalAccessToken = (await originalLogin.json()).accessToken;

    await page.goto(`${webBase}/es/login`);
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/es\/forgot-password$/);
    await page.getByLabel("Email").fill(demoEmail);
    const recoveryResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/forgot-password") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();
    const recoveryResponse = await recoveryResponsePromise;
    expect(recoveryResponse.status()).toBe(200);
    genericResponse = await recoveryResponse.json();
    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();

    const delivered = await waitForResetEmail(mailpit, demoEmail);
    expect(delivered.messages).toHaveLength(1);
    expect(recipientAddresses(delivered.summary)).toEqual([demoEmail]);
    expect(delivered.summary.Subject).toBe("Recupera tu acceso a Kaklen");
    expect(delivered.content).toContain("KAKLEN");
    expect(delivered.content).toContain("30 minutos");
    expect(delivered.resetUrl).toContain("/es/reset-password?token=");

    const rawToken = new URL(delivered.resetUrl).searchParams.get("token");
    expect(rawToken).toBeTruthy();
    const user = await prisma.user.findUnique({ where: { email: demoEmail } });
    expect(user).not.toBeNull();
    const storedToken = await prisma.passwordResetToken.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" }
    });
    expect(storedToken?.sentAt).toBeInstanceOf(Date);
    expect(storedToken?.revokedAt).toBeNull();
    expect(storedToken?.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(storedToken)).not.toContain(rawToken);
    const audit = await prisma.authAuditLog.findFirst({
      where: { userId: user.id, event: "password_reset_requested", success: true },
      orderBy: { createdAt: "desc" }
    });
    if (!audit || !audit.metadata || typeof audit.metadata !== "object") {
      throw new Error("Password reset delivery audit was not persisted");
    }
    expect(audit.metadata).toEqual(expect.objectContaining({ locale: "es" }));
    expect(audit.metadata.messageId).toContain(delivered.summary.MessageID);

    await page.goto(delivered.resetUrl);
    await page.getByLabel(/Nueva contraseña/).fill(temporaryPassword);
    await page.getByLabel("Confirmar contraseña").fill(temporaryPassword);
    const resetResponsePromise = page.waitForResponse(
      (response) =>
        response.url().endsWith("/api/auth/reset-password") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    const resetResponse = await resetResponsePromise;
    expect(resetResponse.status()).toBe(200);
    passwordChanged = true;
    await expect(page.getByRole("heading", { name: "Contraseña actualizada" })).toBeVisible();
    expect(page.url()).not.toContain("token=");

    const oldAccess = await api.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${originalAccessToken}` }
    });
    expect(oldAccess.status()).toBe(401);
    const oldRefresh = await api.post("/api/auth/refresh");
    expect(oldRefresh.status()).toBe(401);
    expect(
      (
        await api.post("/api/auth/login", {
          data: { email: demoEmail, password: demoPassword }
        })
      ).status()
    ).toBe(401);
    expect(
      (
        await api.post("/api/auth/login", {
          data: { email: demoEmail, password: temporaryPassword }
        })
      ).status()
    ).toBe(200);

    await page.goto(delivered.resetUrl);
    await page.getByLabel(/Nueva contraseña/).fill("AnotherPass789!");
    await page.getByLabel("Confirmar contraseña").fill("AnotherPass789!");
    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Enlace utilizado" })).toBeVisible();
  });

  test("keeps the same public response and sends no email for a missing account", async () => {
    await clearMailpit(mailpit);
    const email = `missing-${Date.now()}@kaklen.local`;

    const response = await api.post("/api/auth/forgot-password", { data: { email } });

    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual(genericResponse);
    const messages = await listMessages(mailpit);
    expect(messages).toHaveLength(0);
    expect(await prisma.user.findUnique({ where: { email } })).toBeNull();
  });
});

async function restoreDemoPassword(api, mailpit) {
  if (!api || !mailpit) return;
  await clearMailpit(mailpit);
  const recovery = await api.post("/api/auth/forgot-password", { data: { email: demoEmail } });
  if (recovery.status() !== 200) return;
  const delivered = await waitForResetEmail(mailpit, demoEmail);
  const reset = await api.post("/api/auth/reset-password", {
    data: {
      token: new URL(delivered.resetUrl).searchParams.get("token"),
      password: demoPassword,
      confirmPassword: demoPassword
    }
  });
  expect(reset.status()).toBe(200);
}

async function clearMailpit(mailpit) {
  const response = await mailpit.delete("/api/v1/messages");
  if (![200, 204].includes(response.status())) {
    throw new Error(`Mailpit inbox could not be cleared: HTTP ${response.status()}`);
  }
}

async function waitForResetEmail(mailpit, email) {
  let result = null;
  await expect
    .poll(
      async () => {
        const messages = await listMessages(mailpit);
        const summary = messages.find((entry) => recipientAddresses(entry).includes(email));
        if (!summary) return false;
        const id = typeof summary.ID === "string" ? summary.ID : summary.Id;
        if (typeof id !== "string") return false;
        const response = await mailpit.get(`/api/v1/message/${encodeURIComponent(id)}`);
        if (!response.ok()) return false;
        const detail = await response.json();
        const content = messageContent(detail);
        const resetUrl = resetUrlFromContent(content);
        if (!resetUrl) return false;
        result = { messages, summary, detail, content, resetUrl };
        return true;
      },
      { message: `password reset email for ${email}`, timeout: 15_000, intervals: [100, 250, 500] }
    )
    .toBe(true);
  return result;
}

async function listMessages(mailpit) {
  const response = await mailpit.get("/api/v1/messages");
  expect(response.ok()).toBe(true);
  const body = await response.json();
  return Array.isArray(body.messages) ? body.messages : [];
}

function recipientAddresses(message) {
  const recipients = Array.isArray(message.To) ? message.To : [];
  return recipients
    .map((recipient) => recipient?.Address)
    .filter((address) => typeof address === "string");
}

function messageContent(message) {
  return [message.Text, message.HTML, message.Html]
    .filter((value) => typeof value === "string")
    .join("\n")
    .replaceAll("&amp;", "&");
}

function resetUrlFromContent(content) {
  return content.match(/https?:\/\/[^\s"<>]+\/(?:es|en|pt-BR)\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0] ?? "";
}
