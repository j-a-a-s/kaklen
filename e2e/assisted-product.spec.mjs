import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const demoPassword = "KaklenDemo2026!";

test.describe.serial("Kaklen assisted product journey", () => {
  test.setTimeout(240_000);

  let api;
  let mailpit;
  let accessToken = "";
  let organizationId = "";
  let firstClientId = "";
  let authenticatedCookies = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Origin: webBase } });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    await clearMailpit(mailpit);
    const login = await api.post("/api/auth/login", { data: { email: "empresa.angela@demo.kaklen.local", password: demoPassword } });
    expect(login.status()).toBe(200);
    accessToken = (await login.json()).accessToken;
    authenticatedCookies = (await api.storageState()).cookies;
    const organizations = await authorizedGet("/organizations");
    expect(organizations.status()).toBe(200);
    organizationId = (await organizations.json())[0].id;
    const clients = await authorizedGet(`/organizations/${organizationId}/clients?pageSize=20`);
    firstClientId = (await clients.json()).items[0].id;
  });

  test.afterAll(async () => {
    await api?.dispose();
    await mailpit?.dispose();
  });

  test("derives activation, dashboard metrics, search, and client timeline from demo data", async () => {
    const activation = await authorizedGet(`/organizations/${organizationId}/assistant/activation`);
    expect(activation.status()).toBe(200);
    expect(await activation.json()).toMatchObject({ totalSteps: 7, percentage: 100, isCompleted: true });

    const dashboard = await authorizedGet(`/organizations/${organizationId}/assistant/dashboard`);
    expect(dashboard.status()).toBe(200);
    const summary = await dashboard.json();
    expect(summary.counts.upcomingEvents).toBeGreaterThanOrEqual(1);
    expect(summary.recentActivity.length).toBeGreaterThan(0);
    expect(summary.recommendedAction.route).toContain(`/organizations/${organizationId}/`);

    const search = await authorizedGet(`/organizations/${organizationId}/assistant/search?query=comercial&limit=5`);
    expect(search.status()).toBe(200);
    const groups = Object.values((await search.json()).groups).flat();
    expect(groups.length).toBeGreaterThan(0);
    expect(groups.every((item) => item.route.startsWith(`/organizations/${organizationId}/`))).toBe(true);

    const timeline = await authorizedGet(`/organizations/${organizationId}/assistant/clients/${firstClientId}/timeline`);
    expect(timeline.status()).toBe(200);
    const entries = await timeline.json();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.map((item) => item.occurredAt)).toEqual([...entries].map((item) => item.occurredAt).sort().reverse());
  });

  test("does not disclose the first tenant to another demo owner", async ({ playwright }) => {
    const secondTenant = await playwright.request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Origin: webBase } });
    const unique = Date.now();
    const registration = await secondTenant.post("/api/auth/register", {
      data: {
        email: `tenant-isolation-${unique}@demo.kaklen.local`,
        firstName: "Tenant",
        lastName: "Isolation",
        password: demoPassword
      }
    });
    expect(registration.status()).toBe(201);
    const secondToken = (await registration.json()).accessToken;
    const response = await secondTenant.get(`/api/organizations/${organizationId}/assistant/search?query=comercial`, { headers: { Authorization: `Bearer ${secondToken}` } });
    expect([403, 404]).toContain(response.status());
    await secondTenant.dispose();
  });

  test("completes client, quotation, approval, event, search, timeline, and clean logout in the UI", async ({ page }) => {
    page.setDefaultTimeout(15_000);
    const unique = Date.now();
    const clientName = `Cliente Guiado ${unique}`;
    const productName = `Producto Guiado ${unique}`;
    await resumeDemoSession(page, authenticatedCookies);
    await expect(page.locator("kaklen-dashboard")).toBeVisible();
    await expect(page.getByText("Configuración inicial completada")).toBeVisible();

    for (const command of [
      ["create-client", `/organizations/${organizationId}/clients/new`],
      ["create-catalog", `/organizations/${organizationId}/catalog/new`],
      ["create-quotation", `/organizations/${organizationId}/quotations/new`],
      ["create-event", `/organizations/${organizationId}/events/new`],
      ["invite-member", `/organizations/${organizationId}/members`],
      ["change-organization", "/organizations"]
    ]) {
      await page.keyboard.press("Control+K");
      await expect(page.getByRole("searchbox", { name: /Buscar clientes/ })).toBeFocused();
      const commandButton = page.locator(`[data-command-id="${command[0]}"]`);
      await expect(commandButton).toBeVisible();
      await commandButton.click();
      await expect(page).toHaveURL(new RegExp(`/es${command[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
      await navigateSpa(page, `/organizations/${organizationId}`);
    }

    await navigateSpa(page, `/organizations/${organizationId}/clients/new`);
    await page.getByLabel(/^Nombre/).fill("Cliente");
    await page.getByLabel(/^Apellido/).fill(`Guiado ${unique}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Email").fill("invalid-email");
    await page.getByRole("textbox", { name: /^Teléfono/ }).fill("+56 call-me");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Ingresa un correo válido, por ejemplo nombre@empresa.cl.")).toBeVisible();
    await expect(page.getByText("Ingresa un teléfono válido con código de país, por ejemplo +56 9 1234 5678.")).toBeVisible();
    const recipientEmail = `guided-${unique}@demo.kaklen.local`;
    await page.getByLabel("Email").fill(recipientEmail);
    await page.getByRole("textbox", { name: /^Teléfono/ }).fill("+56 9 1234 5678");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText(clientName, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page).toHaveURL(/\/clients\/[0-9a-f-]+$/);
    const clientId = page.url().split("/").at(-1);
    expect(clientId).toBeTruthy();

    await navigateSpa(page, `/organizations/${organizationId}/catalog/new`);
    await page.getByLabel("Código").fill(`GUIDED-${unique}`);
    await page.getByLabel("Nombre").fill(productName);
    await page.getByLabel("Costo").fill("10000");
    await page.getByLabel("Precio").fill("25000");
    await page.getByRole("button", { name: "Guardar", exact: true }).click();
    await expect(page).toHaveURL(/\/catalog\/[0-9a-f-]+$/);

    await navigateSpa(page, `/organizations/${organizationId}/clients/${clientId}`);
    await page.getByRole("link", { name: "Nueva cotización" }).click();
    await expect(page).toHaveURL(new RegExp(`/organizations/${organizationId}/quotations/new\\?clientId=${clientId}$`));
    const clientSelect = page.locator('select[formControlName="clientId"]');
    await expect(clientSelect).toHaveValue(clientId);
    await page.getByRole("button", { name: "Continuar" }).click();
    const catalogSelect = page.locator('select[formControlName="catalogItemId"]');
    const productOption = catalogSelect.locator("option", { hasText: productName });
    await expect(productOption).toHaveCount(1);
    await catalogSelect.selectOption(await productOption.getAttribute("value"));
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Descuento global (%)").fill("5");
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Guardar cotización" }).click();
    await expect(page).toHaveURL(/\/quotations\/[0-9a-f-]+$/);
    const quotationId = page.url().split("/").at(-1);
    expect(quotationId).toBeTruthy();

    const storedQuotation = await authorizedGet(`/organizations/${organizationId}/quotations/${quotationId}`);
    expect(storedQuotation.status()).toBe(200);
    expect(await storedQuotation.json()).toMatchObject({
      subtotal: "25000",
      discountTotal: "1250",
      taxTotal: "4512.5",
      total: "28262.5",
      globalDiscountPercent: "5"
    });

    await page.getByRole("button", { name: "Más acciones" }).click();
    await expect(page.getByRole("menu")).toBeVisible();
    await page.getByRole("heading", { name: /QUO-/ }).click();
    await expect(page.getByRole("menu")).toBeHidden();

    await page.getByRole("button", { name: "Más acciones" }).click();
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Descargar PDF" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^cotizacion-quo-\d+-v1\.pdf$/);
    const downloadPath = await download.path();
    expect(downloadPath).toBeTruthy();
    const pdf = await readFile(downloadPath);
    expect(pdf.subarray(0, 4).toString("ascii")).toBe("%PDF");

    await clearMailpit(mailpit);
    await page.getByRole("button", { name: "Enviar por email" }).click();
    const emailDialog = page.getByRole("dialog", { name: "Enviar por email" });
    await expect(emailDialog).toBeVisible();
    await expect(emailDialog.getByLabel("Destinatario")).toHaveValue(recipientEmail);
    await emailDialog.getByRole("button", { name: "Enviar email" }).click();
    await expect(emailDialog).toBeHidden();
    await expect(page.getByText("Cotización enviada por email.")).toBeVisible();
    const deliveredEmail = await waitForQuotationEmail(mailpit, recipientEmail);
    expect(deliveredEmail.attachments.some((attachment) => {
      const filename = attachment.FileName ?? attachment.Filename ?? attachment.Name;
      const contentType = attachment.ContentType ?? attachment.ContentTypeHeader;
      return typeof filename === "string" && filename.endsWith(".pdf") && contentType === "application/pdf";
    })).toBe(true);
    await expect(page.getByText(`Enviada por correo a ${recipientEmail}`)).toBeVisible();

    const approve = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/approve`, { note: "Assisted E2E" });
    expect(approve.status()).toBe(200);

    await navigateSpa(page, `/organizations/${organizationId}/events/new?quotationId=${quotationId}`);
    const eventWizardSteps = page.locator(".event-wizard-steps li");
    await expect(eventWizardSteps).toHaveCount(5);
    await expect(eventWizardSteps.first()).toHaveAttribute("aria-current", "step");
    for (let step = 2; step <= 5; step += 1) {
      await page.getByRole("button", { name: "Continuar" }).click();
      await expect(eventWizardSteps.nth(step - 1)).toHaveAttribute("aria-current", "step");
    }
    await page.getByRole("button", { name: "Crear evento en borrador" }).click();
    await page.getByRole("button", { name: "Crear evento", exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);
    const eventName = (await page.getByRole("heading", { level: 1 }).innerText()).trim();
    const eventId = page.url().split("/").at(-1);

    await navigateSpa(page, `/organizations/${organizationId}/events/calendar`);
    const weeklyEvent = page.locator(".weekly-event-link", { hasText: eventName });
    await expect(weeklyEvent).toBeVisible();
    await weeklyEvent.focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(new RegExp(`/organizations/${organizationId}/events/${eventId}$`));

    await page.keyboard.press("Control+K");
    const palette = page.getByRole("dialog", { name: "¿Qué necesitas hacer?" });
    await expect(palette).toBeVisible();
    await palette.getByRole("searchbox").fill("Cliente Guiado");
    await expect(palette.getByText(clientName, { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await navigateSpa(page, `/organizations/${organizationId}/clients/${clientId}`);
    await expect(page.getByRole("heading", { name: "Línea de tiempo" })).toBeVisible();
    await expect(page.getByText("Cotización aprobada")).toBeVisible();
    await expect(page.getByText("Evento creado")).toBeVisible();

    const responsivePaths = [
      `/organizations/${organizationId}`,
      `/organizations/${organizationId}/clients/new`,
      `/organizations/${organizationId}/quotations/new`
    ];
    for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1366, height: 768 }, { width: 1440, height: 900 }]) {
      await page.setViewportSize(viewport);
      for (const path of responsivePaths) {
        await navigateSpa(page, path);
        await expectNoHorizontalOverflow(page);
      }
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateSpa(page, `/organizations/${organizationId}`);
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await expect(page.locator("#authenticated-navigation")).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Abrir perfil" }).click();
    await page.getByRole("menuitem", { name: "Buscar o ir a..." }).click();
    await expect(page.getByRole("dialog", { name: "¿Qué necesitas hacer?" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 720 });
    await navigateSpa(page, `/organizations/${organizationId}/clients/${clientId}`);
    await page.getByRole("button", { name: "Abrir perfil" }).click();
    await page.getByRole("menuitem", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/es\/login$/);
    await expect(page.getByText(clientName)).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/\/es\/login$/);
  });

  async function authorizedGet(path) {
    return api.get(`/api${path}`, { headers: { Authorization: `Bearer ${accessToken}` } });
  }

  async function authorizedPost(path, data) {
    return api.post(`/api${path}`, { data, headers: { Authorization: `Bearer ${accessToken}` } });
  }
});

async function resumeDemoSession(page, cookies) {
  await page.context().addCookies(cookies);
  await page.goto(`${webBase}/es/dashboard`);
  await expect(page).toHaveURL(/\/es\/dashboard$/);
  await expect(page.locator("kaklen-dashboard")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("kaklen.activeOrganizationId"))).not.toBeNull();
}

async function expectNoHorizontalOverflow(page) {
  const sizes = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(sizes.scrollWidth).toBeLessThanOrEqual(sizes.clientWidth);
}

async function navigateSpa(page, route) {
  const localizedRoute = `/es${route}`;
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, localizedRoute);
  await expect(page).toHaveURL(new RegExp(`${localizedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await page.locator("main").last().waitFor();
}

async function clearMailpit(mailpit) {
  const response = await mailpit.delete("/api/v1/messages");
  expect([200, 204]).toContain(response.status());
}

async function waitForQuotationEmail(mailpit, recipient) {
  let detail = null;
  await expect.poll(async () => {
    const response = await mailpit.get("/api/v1/messages");
    if (!response.ok()) return false;
    const body = await response.json();
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const message = messages.find((entry) => {
      const recipients = Array.isArray(entry.To) ? entry.To : [];
      return recipients.some((item) => item?.Address === recipient);
    });
    const id = message?.ID ?? message?.Id;
    if (typeof id !== "string") return false;
    const detailResponse = await mailpit.get(`/api/v1/message/${encodeURIComponent(id)}`);
    if (!detailResponse.ok()) return false;
    detail = await detailResponse.json();
    return Array.isArray(detail.Attachments) && detail.Attachments.length > 0;
  }, { message: `quotation email with PDF for ${recipient}`, timeout: 15_000, intervals: [100, 250, 500] }).toBe(true);
  return { attachments: detail.Attachments };
}
