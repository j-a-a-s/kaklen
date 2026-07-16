import { expect, test } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";

test.describe.serial("secure password recovery with Mailpit", () => {
  test.setTimeout(180_000);

  let api;
  let mailpit;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Origin: "http://localhost:4200" }
    });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    await clearMailpit(mailpit);
  });

  test.afterAll(async () => {
    await api?.dispose();
    await mailpit?.dispose();
  });

  test("resets a real account and invalidates old credentials and sessions", async ({ page }) => {
    const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const email = `recovery-${unique}@kaklen.local`;
    const oldPassword = "OriginalPass123!";
    const newPassword = "UpdatedPass456!";
    const registered = await api.post("/api/auth/register", {
      data: { email, firstName: "Recovery", lastName: "Tester", password: oldPassword }
    });
    expect(registered.status()).toBe(201);
    const originalAccessToken = (await registered.json()).accessToken;

    await page.goto(`${webBase}/es/login`);
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();
    await expect(page).toHaveURL(/\/es\/forgot-password$/);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();
    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();

    const resetUrl = await waitForResetUrl(mailpit, email);
    expect(resetUrl).toContain("/es/reset-password?token=");
    await page.goto(resetUrl);
    await page.getByLabel(/Nueva contraseña/).fill(newPassword);
    await page.getByLabel("Confirmar contraseña").fill(newPassword);
    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Contraseña actualizada" })).toBeVisible();
    expect(page.url()).not.toContain("token=");

    const oldAccess = await api.get("/api/auth/me", {
      headers: { Authorization: `Bearer ${originalAccessToken}` }
    });
    expect(oldAccess.status()).toBe(401);
    const oldRefresh = await api.post("/api/auth/refresh");
    expect(oldRefresh.status()).toBe(401);

    const oldLogin = await api.post("/api/auth/login", {
      data: { email, password: oldPassword }
    });
    expect(oldLogin.status()).toBe(401);
    const newLogin = await api.post("/api/auth/login", {
      data: { email, password: newPassword }
    });
    expect(newLogin.status()).toBe(200);

    await page.goto(resetUrl);
    await page.getByLabel(/Nueva contraseña/).fill("AnotherPass789!");
    await page.getByLabel("Confirmar contraseña").fill("AnotherPass789!");
    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Enlace utilizado" })).toBeVisible();
  });

  test("keeps the same public response and sends no email for a missing account", async ({ page }) => {
    await clearMailpit(mailpit);
    const email = `missing-${Date.now()}@kaklen.local`;

    await page.goto(`${webBase}/es/forgot-password`);
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Enviar instrucciones" }).click();
    await expect(page.getByRole("heading", { name: "Revisa tu correo" })).toBeVisible();

    const messages = await listMessages(mailpit);
    expect(messages.some((message) => recipientAddresses(message).includes(email))).toBe(false);
  });
});

async function clearMailpit(mailpit) {
  const response = await mailpit.delete("/api/v1/messages");
  if (![200, 204].includes(response.status())) {
    throw new Error(`Mailpit inbox could not be cleared: HTTP ${response.status()}`);
  }
}

async function waitForResetUrl(mailpit, email) {
  await expect
    .poll(
      async () => {
        const messages = await listMessages(mailpit);
        const message = messages.find((entry) => recipientAddresses(entry).includes(email));
        if (!message) return "";
        const id = typeof message.ID === "string" ? message.ID : message.Id;
        if (typeof id !== "string") return "";
        const response = await mailpit.get(`/api/v1/message/${encodeURIComponent(id)}`);
        if (!response.ok()) return "";
        const detail = await response.json();
        return resetUrlFromMessage(detail);
      },
      { message: `password reset email for ${email}`, timeout: 15_000, intervals: [100, 250, 500] }
    )
    .not.toBe("");

  const messages = await listMessages(mailpit);
  const message = messages.find((entry) => recipientAddresses(entry).includes(email));
  const id = typeof message?.ID === "string" ? message.ID : message?.Id;
  const detailResponse = await mailpit.get(`/api/v1/message/${encodeURIComponent(id)}`);
  return resetUrlFromMessage(await detailResponse.json());
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

function resetUrlFromMessage(message) {
  const content = [message.Text, message.HTML, message.Html]
    .filter((value) => typeof value === "string")
    .join("\n")
    .replaceAll("&amp;", "&");
  return content.match(/https?:\/\/[^\s"<>]+\/es\/reset-password\?token=[A-Za-z0-9_-]+/)?.[0] ?? "";
}
