import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import {
  clearMailpit,
  listMailpitMessages,
  recipientAddresses,
  waitForMailpitEmail
} from "./support/mailpit.mjs";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const verificationUrlPattern = /https?:\/\/[^\s"<>]+\/(?:es|en|pt-BR)\/verify-email\?token=[A-Za-z0-9_-]+/;
const password = "KaklenVerify2026!";

test.describe.serial("mandatory email verification with real Mailpit delivery", () => {
  test.setTimeout(180_000);

  let api;
  let mailpit;
  let prisma;
  const createdEmails = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Origin: webBase, "X-Forwarded-For": "198.51.100.41" }
    });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    prisma = new PrismaClient();
    await clearMailpit(mailpit);
  });

  test.afterAll(async () => {
    if (createdEmails.length > 0) {
      await prisma?.user.deleteMany({ where: { email: { in: createdEmails } } });
    }
    await clearMailpit(mailpit);
    await prisma?.$disconnect();
    await api?.dispose();
    await mailpit?.dispose();
  });

  test("registers pending, verifies from Mailpit, and requires a manual login", async ({ page }) => {
    const email = `verify-${Date.now()}@kaklen.local`;
    createdEmails.push(email);

    await page.goto(`${webBase}/es/register`);
    await page.getByLabel(/^Nombre/).fill("Correo");
    await page.getByLabel(/^Apellido/).fill("Pendiente");
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill(password);
    const registrationPromise = page.waitForResponse(
      (response) => response.url().endsWith("/api/auth/register") && response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    const registration = await registrationPromise;

    expect(registration.status()).toBe(201);
    expect((await registration.allHeaders())["set-cookie"]).toBeUndefined();
    expect(await registration.json()).toEqual({
      message: "Cuenta creada. Revisa tu correo para confirmar tu dirección."
    });
    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();
    await expect(page).toHaveURL(/\/es\/register$/);

    const pendingUser = await prisma.user.findUnique({ where: { email } });
    if (!pendingUser) throw new Error("Pending registration was not persisted");
    expect(pendingUser.status).toBe("ACTIVE");
    expect(pendingUser.emailVerifiedAt).toBeNull();
    expect(await prisma.refreshToken.count({ where: { userId: pendingUser.id } })).toBe(0);

    const blockedLogin = await api.post("/api/auth/login", { data: { email, password } });
    expect(blockedLogin.status()).toBe(403);
    expect(await blockedLogin.json()).toEqual(
      expect.objectContaining({ code: "EMAIL_NOT_VERIFIED", statusCode: 403 })
    );
    expect((await api.storageState()).cookies).toHaveLength(0);

    const delivered = await waitForMailpitEmail(mailpit, {
      recipient: email,
      subject: "Confirma tu cuenta de Kaklen",
      urlPattern: verificationUrlPattern
    });
    expect(recipientAddresses(delivered.summary)).toEqual([email]);
    expect(delivered.content).toContain("Confirmar correo");
    expect(delivered.content).toContain("1 día");

    const rawToken = new URL(delivered.url).searchParams.get("token");
    expect(rawToken).toBeTruthy();
    const storedToken = await prisma.emailVerificationToken.findFirst({
      where: { userId: pendingUser.id },
      orderBy: { createdAt: "desc" }
    });
    expect(storedToken?.sentAt).toBeInstanceOf(Date);
    expect(storedToken?.usedAt).toBeNull();
    expect(storedToken?.revokedAt).toBeNull();
    expect(storedToken?.tokenHash).not.toBe(rawToken);
    expect(JSON.stringify(storedToken)).not.toContain(rawToken);

    await page.goto(delivered.url);
    await expect(page.getByRole("heading", { name: "Correo confirmado" })).toBeVisible();
    expect(page.url()).not.toContain("token=");
    await expect(page).toHaveURL(/\/es\/verify-email$/);

    const usedAgain = await api.post("/api/auth/verify-email", { data: { token: rawToken } });
    expect(usedAgain.status()).toBe(410);
    expect((await usedAgain.json()).code).toBe("EMAIL_VERIFICATION_TOKEN_USED");
    expect((await api.storageState()).cookies).toHaveLength(0);

    await page.getByRole("link", { name: "Abrir inicio de sesión" }).click();
    await page.getByLabel(/^Email/).fill(email);
    await page.getByLabel(/^Contraseña/).fill(password);
    await page.getByRole("button", { name: "Ingresar" }).click();
    await expect(page).toHaveURL(/\/es\/dashboard$/);
  });

  test("resends safely, revokes the previous link, and excludes pending accounts from recovery", async () => {
    const email = `resend-${Date.now()}@kaklen.local`;
    createdEmails.push(email);
    const registration = await api.post("/api/auth/register", {
      data: {
        email,
        firstName: "Reenvío",
        lastName: "Seguro",
        password,
        locale: "pt-BR"
      }
    });
    expect(registration.status()).toBe(201);

    const first = await waitForMailpitEmail(mailpit, {
      recipient: email,
      subject: "Confirme sua conta do Kaklen",
      urlPattern: verificationUrlPattern
    });
    expect(first.url).toContain("/pt-BR/verify-email?token=");

    const recovery = await api.post("/api/auth/forgot-password", { data: { email } });
    expect(recovery.status()).toBe(200);
    expect(await prisma.passwordResetToken.count({ where: { user: { email } } })).toBe(0);
    const messagesAfterRecovery = await listMailpitMessages(mailpit);
    expect(
      messagesAfterRecovery.filter(
        (message) => recipientAddresses(message).includes(email) && message.Subject !== "Confirme sua conta do Kaklen"
      )
    ).toHaveLength(0);

    const resend = await api.post("/api/auth/resend-verification-email", { data: { email } });
    expect(resend.status()).toBe(200);
    expect(await resend.json()).toEqual({
      message: "Si la cuenta requiere confirmación, enviaremos un nuevo correo."
    });
    const second = await waitForMailpitEmail(mailpit, {
      recipient: email,
      subject: "Confirme sua conta do Kaklen",
      urlPattern: verificationUrlPattern,
      excludedIds: [first.id]
    });

    const firstToken = new URL(first.url).searchParams.get("token");
    const secondToken = new URL(second.url).searchParams.get("token");
    expect(firstToken).not.toBe(secondToken);
    const revoked = await api.post("/api/auth/verify-email", { data: { token: firstToken } });
    expect(revoked.status()).toBe(410);
    expect((await revoked.json()).code).toBe("EMAIL_VERIFICATION_TOKEN_REVOKED");

    const confirmed = await api.post("/api/auth/verify-email", { data: { token: secondToken } });
    expect(confirmed.status()).toBe(200);
    expect((await api.storageState()).cookies).toHaveLength(0);
    const login = await api.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    expect((await login.json()).user.emailVerifiedAt).toBeTruthy();
  });
});
