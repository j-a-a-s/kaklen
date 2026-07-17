import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { waitForMailpitEmail } from "./support/mailpit.mjs";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const demoPassword = "KaklenDemo2026!";
const verificationUrlPattern = /https?:\/\/[^\s"<>]+\/(?:es|en|pt-BR)\/verify-email\?token=[A-Za-z0-9_-]+/;

test.describe.serial("Kaklen assisted product journey", () => {
  test.setTimeout(240_000);

  let api;
  let mailpit;
  let accessToken = "";
  let organizationId = "";
  let firstClientId = "";
  let authenticatedCookies = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Origin: webBase, "X-Forwarded-For": "198.51.100.31" }
    });
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
    const secondTenant = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: { Origin: webBase, "X-Forwarded-For": "198.51.100.32" }
    });
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
    const secondEmail = `tenant-isolation-${unique}@demo.kaklen.local`;
    const delivered = await waitForMailpitEmail(mailpit, {
      recipient: secondEmail,
      subject: "Confirma tu cuenta de Kaklen",
      urlPattern: verificationUrlPattern
    });
    const verification = await secondTenant.post("/api/auth/verify-email", {
      data: { token: new URL(delivered.url).searchParams.get("token") }
    });
    expect(verification.status()).toBe(200);
    const secondLogin = await secondTenant.post("/api/auth/login", {
      data: { email: secondEmail, password: demoPassword }
    });
    expect(secondLogin.status()).toBe(200);
    const secondToken = (await secondLogin.json()).accessToken;
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
    await page.getByLabel(/^RUT o identificación tributaria/).fill(buildUniqueChileanRut(unique));
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Email").fill("invalid-email");
    await page.getByRole("textbox", { name: /^Teléfono/ }).fill("+56 call-me");
    await page.getByRole("button", { name: "Continuar" }).click();
    await expect(page.getByText("Ingresa un correo válido, por ejemplo nombre@empresa.cl.")).toBeVisible();
    await expect(page.getByText("Ingresa un teléfono válido con código de país, por ejemplo +56 9 1234 5678.")).toBeVisible();
    await page.getByLabel("Email").fill(`guided-${unique}@demo.kaklen.local`);
    await page.getByRole("textbox", { name: /^Teléfono/ }).fill("+56 9 1234 5678");
    await page.getByRole("textbox", { name: /^WhatsApp/ }).fill("+56 9 1234 5678");
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

    await expect(page.getByRole("button", { name: "Enviar por email" })).toHaveCount(0);

    const send = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/send`, { note: "Assisted E2E ready for review" });
    expect(send.status()).toBe(200);
    const approve = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/approve`, { note: "Assisted E2E" });
    expect(approve.status()).toBe(200);

    await navigateSpa(page, `/organizations/${organizationId}/events/new?quotationId=${quotationId}`);
    const eventWizardSteps = page.locator(".event-wizard-steps li");
    await expect(eventWizardSteps).toHaveCount(5);
    await expect(eventWizardSteps.first()).toHaveAttribute("aria-current", "step");
    await expect(page.locator('select[formControlName="quotationId"]')).toHaveValue(quotationId);
    await expect(page.locator('input[formControlName="name"]')).not.toHaveValue("");
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
    for (const viewport of [
      { width: 320, height: 568 },
      { width: 390, height: 844 },
      { width: 768, height: 1024 },
      { width: 820, height: 1180 },
      { width: 1366, height: 768 },
      { width: 1440, height: 900 },
      { width: 1920, height: 1080 }
    ]) {
      await page.setViewportSize(viewport);
      for (const path of responsivePaths) {
        await navigateSpa(page, path);
        await expectNoHorizontalOverflow(page);
        await expectWizardStepsReadable(page);
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
  try {
    await expect.poll(
      () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth),
      { message: `Horizontal layout did not settle at ${page.url()}`, timeout: 2_000 }
    ).toBeLessThanOrEqual(0);
  } catch (error) {
    const diagnostics = await page.evaluate(() => {
      const clientWidth = document.documentElement.clientWidth;
      const overflowingElements = [...document.querySelectorAll("body *")]
        .map((element) => {
          const bounds = element.getBoundingClientRect();
          return {
            element: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${[...element.classList].map((name) => `.${name}`).join("")}`,
            left: Math.round(bounds.left),
            right: Math.round(bounds.right),
            width: Math.round(bounds.width)
          };
        })
        .filter((element) => element.right > clientWidth + 1)
        .slice(0, 10);
      return {
        clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
        overflowingElements
      };
    });
    throw new Error(`${error instanceof Error ? error.message : String(error)}\n${JSON.stringify(diagnostics, null, 2)}`);
  }
}

async function expectWizardStepsReadable(page) {
  const wizard = page.locator(".wizard-steps");
  if ((await wizard.count()) === 0) {
    return;
  }

  const metrics = await wizard.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    labels: [...element.querySelectorAll("strong")].map((label) => ({
      clientWidth: label.clientWidth,
      scrollWidth: label.scrollWidth
    }))
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.labels.length).toBeGreaterThan(0);
  expect(metrics.labels.every((label) => label.clientWidth > 0 && label.scrollWidth <= label.clientWidth + 1)).toBe(true);
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

function buildUniqueChileanRut(seed) {
  const body = 10_000_000 + (Number(String(seed).slice(-7)) % 9_000_000);
  let sum = 0;
  let multiplier = 2;
  for (const digit of String(body).split("").reverse()) {
    sum += Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const remainder = 11 - (sum % 11);
  const verifier = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return `${body}-${verifier}`;
}
