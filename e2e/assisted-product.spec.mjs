import { expect, test } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const demoPassword = "KaklenDemo2026!";

test.describe.serial("Kaklen assisted product journey", () => {
  test.setTimeout(240_000);

  let api;
  let accessToken = "";
  let organizationId = "";
  let firstClientId = "";
  let authenticatedCookies = [];

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({ baseURL: apiBase, extraHTTPHeaders: { Origin: webBase } });
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

    await navigateSpa(page, `/organizations/${organizationId}/clients/new`);
    await page.getByLabel(/^Nombre/).fill("Cliente");
    await page.getByLabel(/^Apellido/).fill(`Guiado ${unique}`);
    await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByLabel("Email").fill(`guided-${unique}@demo.kaklen.local`);
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

    const send = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/send`, { note: "Assisted E2E" });
    expect(send.status()).toBe(200);
    const approve = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/approve`, { note: "Assisted E2E" });
    expect(approve.status()).toBe(200);

    await navigateSpa(page, `/organizations/${organizationId}/events/new?quotationId=${quotationId}`);
    for (let step = 1; step < 5; step += 1) await page.getByRole("button", { name: "Continuar" }).click();
    await page.getByRole("button", { name: "Crear evento en borrador" }).click();
    await page.getByRole("button", { name: "Crear evento", exact: true }).click();
    await expect(page).toHaveURL(/\/events\/[0-9a-f-]+$/);

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
    await page.getByRole("button", { name: "Buscar o ir a..." }).click();
    await expect(page.getByRole("dialog", { name: "¿Qué necesitas hacer?" })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.setViewportSize({ width: 1280, height: 720 });
    await navigateSpa(page, `/organizations/${organizationId}/clients/${clientId}`);
    await page.getByRole("button", { name: "Salir" }).click();
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
