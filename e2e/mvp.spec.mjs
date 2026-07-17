import { expect, test } from "@playwright/test";
import { clearMailpit, waitForMailpitEmail } from "./support/mailpit.mjs";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const verificationUrlPattern = /https?:\/\/[^\s"<>]+\/(?:es|en|pt-BR)\/verify-email\?token=[A-Za-z0-9_-]+/;

test.describe.serial("Kaklen MVP core workflow", () => {
  test.setTimeout(180_000);

  let api;
  let mailpit;
  let accessToken = "";
  let organizationId = "";
  let clientId = "";
  let productId = "";
  let quotationId = "";
  let publicToken = "";
  let checkoutToken = "";
  let eventId = "";

  test.beforeAll(async ({ playwright }, testInfo) => {
    testInfo.setTimeout(180_000);
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: {
        Origin: webBase,
        "X-Forwarded-For": "198.51.100.51"
      }
    });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    await clearMailpit(mailpit);
    await waitForReady(api);
  });

  test.afterAll(async () => {
    await api?.dispose();
    await mailpit?.dispose();
  });

  test("health checks expose build metadata", async () => {
    for (const path of ["/api/health", "/api/health/live", "/api/health/ready"]) {
      const response = await api.get(path);
      expect(response.ok(), `${path} should be healthy`).toBe(true);
      const body = await response.json();
      expect(body.version).toBeTruthy();
      expect(body.commitSha).toBeTruthy();
      expect(body.buildTime).toBeTruthy();
      expect(body.environment).toBeTruthy();
    }
  });

  test("localized login routes render for es en and pt-BR", async ({ request }) => {
    for (const locale of ["es", "en", "pt-BR"]) {
      const response = await request.get(`${webBase}/${locale}/login`);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("text/html");
      await expectRuntimeConfig(request, locale);
    }
  });

  test("registers pending, verifies, logs in, refreshes, and loads current user", async () => {
    const unique = Date.now();
    const email = `mvp-${unique}@kaklen.local`;
    const password = "KaklenTest123!";
    const response = await api.post("/api/auth/register", {
      data: {
        email,
        firstName: "MVP",
        lastName: "Tester",
        password
      }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()["set-cookie"]).toBeUndefined();

    expect(await response.json()).toEqual({
      message: "Cuenta creada. Revisa tu correo para confirmar tu dirección."
    });
    const delivered = await waitForMailpitEmail(mailpit, {
      recipient: email,
      subject: "Confirma tu cuenta de Kaklen",
      urlPattern: verificationUrlPattern
    });
    const token = new URL(delivered.url).searchParams.get("token");
    const verification = await api.post("/api/auth/verify-email", { data: { token } });
    expect(verification.status()).toBe(200);

    const login = await api.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    const body = await login.json();
    accessToken = body.accessToken;
    expect(body.user.email).toBe(email);
    expect(body.user.locale).toBe("es");
    expect(body.user.emailVerifiedAt).toBeTruthy();

    const me = await authorizedGet("/auth/me");
    expect(me.status()).toBe(200);

    const refresh = await api.post("/api/auth/refresh");
    expect(refresh.status()).toBe(200);
    const refreshed = await refresh.json();
    accessToken = refreshed.accessToken;
    expect(refreshed.user.id).toBe(body.user.id);
  });

  test("creates and updates an organization with Chilean settings", async () => {
    const unique = Date.now();
    const create = await authorizedPost("/organizations", {
      name: `MVP Org ${unique}`,
      legalName: "MVP Org SpA",
      taxId: "12.345.678-5",
      country: "CL",
      currency: "CLP",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });
    expect(create.status()).toBe(201);
    const organization = await create.json();
    organizationId = organization.id;
    expect(organization.country).toBe("CL");
    expect(organization.currency).toBe("CLP");

    const permissions = await authorizedGet(`/organizations/${organizationId}/me/permissions`);
    expect(permissions.status()).toBe(200);
    const permissionsBody = await permissions.json();
    expect(permissionsBody.permissions).toEqual(expect.arrayContaining(["clients.create", "catalog.create", "quotations.create", "events.create"]));

    const update = await authorizedPatch(`/organizations/${organizationId}`, {
      name: `${organization.name} Validated`,
      defaultLocale: "es"
    });
    expect(update.status()).toBe(200);
    expect((await update.json()).defaultLocale).toBe("es");

    const validUpdate = await authorizedPatch(`/organizations/${organizationId}`, {
      name: `${organization.name} Validated`,
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });
    expect(validUpdate.status()).toBe(200);
  });

  test("validates RUT and manages clients", async () => {
    const invalidRut = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "LEGAL_ENTITY",
      legalName: "RUT Inválido SpA",
      taxId: "123",
      whatsapp: "+56911111110",
      country: "CL"
    });
    expect(invalidRut.status()).toBe(400);

    const createNatural = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "NATURAL_PERSON",
      status: "ACTIVE",
      firstName: "Ángela",
      lastName: "Pérez",
      email: "angela.mvp@kaklen.local",
      taxId: "11.111.111-1",
      whatsapp: "+56911111111",
      country: "CL"
    });
    expect(createNatural.status()).toBe(201);
    clientId = (await createNatural.json()).id;

    const createCompany = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "LEGAL_ENTITY",
      status: "ACTIVE",
      legalName: "Empresa MVP SpA",
      taxId: "12.345.678-5",
      whatsapp: "+56911111112",
      country: "CL"
    });
    expect(createCompany.status()).toBe(201);

    const duplicateRut = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "LEGAL_ENTITY",
      legalName: "Empresa Duplicada SpA",
      taxId: "12.345.678-5",
      whatsapp: "+56911111113",
      country: "CL"
    });
    expect(duplicateRut.status()).toBe(409);

    const list = await authorizedGet(`/organizations/${organizationId}/clients?search=Ángela&page=1&pageSize=10`);
    expect(list.status()).toBe(200);
    expect((await list.json()).total).toBeGreaterThanOrEqual(1);

    const update = await authorizedPatch(`/organizations/${organizationId}/clients/${clientId}`, {
      city: "Santiago",
      notes: "Validated by MVP E2E"
    });
    expect(update.status()).toBe(200);
  });

  test("manages catalog products and services", async () => {
    const product = await authorizedPost(`/organizations/${organizationId}/catalog`, {
      type: "PRODUCT",
      sku: "MVP-PROD-001",
      code: "MVP-PRODUCT",
      name: "Producto MVP",
      unit: "unidad",
      cost: 10000,
      price: 25000,
      taxPercent: 19,
      currency: "CLP"
    });
    expect(product.status()).toBe(201);
    const productBody = await product.json();
    productId = productBody.id;
    expect(productBody.trackInventory).toBe(true);

    const service = await authorizedPost(`/organizations/${organizationId}/catalog`, {
      type: "SERVICE",
      code: "MVP-SERVICE",
      name: "Servicio MVP",
      unit: "hora",
      cost: 15000,
      price: 45000,
      taxPercent: 19,
      currency: "CLP"
    });
    expect(service.status()).toBe(201);
    expect((await service.json()).trackInventory).toBe(false);

    const duplicate = await authorizedPost(`/organizations/${organizationId}/catalog`, {
      type: "PRODUCT",
      code: "MVP-PRODUCT",
      name: "Producto duplicado",
      unit: "unidad",
      cost: 1,
      price: 1,
      taxPercent: 0,
      currency: "CLP"
    });
    expect(duplicate.status()).toBe(409);

    const filtered = await authorizedGet(`/organizations/${organizationId}/catalog?type=PRODUCT&code=MVP-PRODUCT&page=1&pageSize=10`);
    expect(filtered.status()).toBe(200);
    expect((await filtered.json()).total).toBeGreaterThanOrEqual(1);
  });

  test("completes the secure quotation, WhatsApp, payment, notification, and provider flow", async () => {
    const create = await authorizedPost(`/organizations/${organizationId}/quotations`, {
      clientId,
      issueDate: "2026-07-15",
      validUntil: "2026-08-15",
      currency: "CLP",
      items: [
        {
          catalogItemId: productId,
          type: "PRODUCT",
          code: "MVP-PRODUCT",
          name: "Producto MVP",
          quantity: 2,
          unit: "unidad",
          unitPrice: 25000,
          taxPercent: 19
        }
      ]
    });
    expect(create.status()).toBe(201);
    const quotation = await create.json();
    quotationId = quotation.id;
    expect(quotation.total).toBeTruthy();

    const link = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/public-link`, {
      locale: "es"
    });
    expect(link.status()).toBe(201);
    const linkBody = await link.json();
    publicToken = linkBody.publicToken;
    expect(publicToken).toMatch(/^[A-Za-z0-9_-]{40,80}$/);
    expect(linkBody.url).toContain(`/es/p/quotations/${publicToken}`);

    const publicView = await api.get(`/api/portal/quotations/${publicToken}`);
    expect(publicView.status()).toBe(200);
    expect(await publicView.json()).toMatchObject({
      quotation: { version: 1, isLatestVersion: true, status: "SENT" },
      actions: { canRequestChanges: true, canApproveAndPay: true }
    });

    const whatsapp = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/whatsapp/prepare`, {
      publicToken,
      locale: "es"
    });
    expect(whatsapp.status()).toBe(200);
    const whatsappBody = await whatsapp.json();
    expect(whatsappBody).toMatchObject({ mode: "manual", status: "PREPARED" });
    expect(whatsappBody.waUrl).toContain("https://wa.me/56911111111?text=");
    expect(whatsappBody.message).toContain(linkBody.url);
    expect(whatsappBody.message).not.toContain("Ángela Pérez");
    expect(whatsappBody.message).not.toContain(quotation.total);

    const changes = await api.post(`/api/portal/quotations/${publicToken}/change-requests`, {
      data: { comment: "Necesito ajustar la cantidad del producto.", itemIndexes: [0] }
    });
    expect(changes.status()).toBe(201);
    expect((await changes.json()).status).toBe("CHANGES_REQUESTED");

    const version = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/new-version`, {});
    expect(version.status()).toBe(200);
    const versionBody = await version.json();
    expect(versionBody.version).toBe(2);
    quotationId = versionBody.id;

    const oldVersion = await api.get(`/api/portal/quotations/${publicToken}`);
    expect(oldVersion.status()).toBe(200);
    expect(await oldVersion.json()).toMatchObject({
      quotation: { version: 1, latestVersion: 2, isLatestVersion: false },
      actions: { canRequestChanges: false, canApproveAndPay: false }
    });

    const latestLink = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/public-link`, {
      locale: "es"
    });
    expect(latestLink.status()).toBe(201);
    publicToken = (await latestLink.json()).publicToken;

    const idempotencyKey = crypto.randomUUID();
    const payment = await api.post(`/api/portal/quotations/${publicToken}/payments`, {
      data: { idempotencyKey, locale: "es" }
    });
    expect(payment.status()).toBe(201);
    const paymentBody = await payment.json();
    expect(paymentBody).toMatchObject({ status: "PENDING", currency: "CLP" });

    const repeatedPayment = await api.post(`/api/portal/quotations/${publicToken}/payments`, {
      data: { idempotencyKey, locale: "es" }
    });
    expect(repeatedPayment.status()).toBe(201);
    const repeatedPaymentBody = await repeatedPayment.json();
    expect(repeatedPaymentBody.paymentId).toBe(paymentBody.paymentId);
    checkoutToken = new URL(repeatedPaymentBody.checkoutUrl).pathname.split("/").at(-1) ?? "";
    expect(checkoutToken).toMatch(/^[A-Za-z0-9_-]{40,80}$/);

    const checkout = await api.get(`/api/portal/payments/checkout/${checkoutToken}`);
    expect(checkout.status()).toBe(200);
    expect(await checkout.json()).toMatchObject({ payment: { status: "PENDING" }, sandbox: true });

    const completed = await api.post(`/api/portal/payments/checkout/${checkoutToken}/complete`, {
      data: { outcome: "PAID" }
    });
    expect(completed.status()).toBe(200);
    expect((await completed.json()).status).toBe("PAID");

    const paidQuotation = await authorizedGet(`/organizations/${organizationId}/quotations/${quotationId}`);
    expect(paidQuotation.status()).toBe(200);
    expect((await paidQuotation.json()).paidAt).toBeTruthy();

    const notifications = await authorizedGet(`/organizations/${organizationId}/notifications`);
    expect(notifications.status()).toBe(200);
    expect((await notifications.json()).map((notification) => notification.type)).toEqual(
      expect.arrayContaining([
        "QUOTATION_VIEWED",
        "QUOTATION_CHANGES_REQUESTED",
        "QUOTATION_APPROVED",
        "PAYMENT_STARTED",
        "PAYMENT_CONFIRMED"
      ])
    );

    const paidPortal = await api.get(`/api/portal/quotations/${publicToken}`);
    expect(paidPortal.status()).toBe(200);
    expect(await paidPortal.json()).toMatchObject({ actions: { canOfferServices: true } });

    const recommendation = await api.post(`/api/portal/quotations/${publicToken}/provider-profile/recommendation-view`);
    expect(recommendation.status()).toBe(200);
    const provider = await api.post(`/api/portal/quotations/${publicToken}/provider-profile`, {
      data: {
        consent: true,
        category: "Producción de eventos",
        description: "Servicios profesionales de producción y coordinación de eventos.",
        country: "CL",
        region: "Metropolitana de Santiago",
        city: "Santiago",
        whatsapp: "+56911111111",
        price: 50000,
        currency: "CLP"
      }
    });
    expect(provider.status()).toBe(201);
    expect(await provider.json()).toMatchObject({ status: "IN_REVIEW", whatsapp: "+56911111111" });
  });

  test("renders the public quotation and payment checkout without horizontal overflow", async ({ page }) => {
    for (const locale of ["es", "en", "pt-BR"]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${webBase}/${locale}/p/quotations/${publicToken}`);
      await expect(page.locator("kaklen-public-quotation")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

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
      await page.goto(`${webBase}/es/p/quotations/${publicToken}`);
      await expect(page.locator("kaklen-public-quotation")).toBeVisible();
      await expectNoHorizontalOverflow(page);
      await page.goto(`${webBase}/es/p/payments/${checkoutToken}`);
      await expect(page.locator("kaklen-payment-checkout")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("creates event from approved quotation and completes operations", async () => {
    const startAt = "2026-08-20T14:00:00.000Z";
    const endAt = "2026-08-20T18:00:00.000Z";
    const create = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/create-event`, {
      name: "Evento MVP",
      startAt,
      endAt,
      city: "Santiago",
      country: "CL"
    });
    expect(create.status()).toBe(201);
    const event = await create.json();
    eventId = event.id;
    expect(event.quotationId).toBe(quotationId);

    const participant = await authorizedPost(`/organizations/${organizationId}/events/${eventId}/participants`, {
      clientId,
      role: "CLIENT_CONTACT",
      notes: "E2E participant"
    });
    expect(participant.status()).toBe(201);

    const task = await authorizedPost(`/organizations/${organizationId}/events/${eventId}/tasks`, {
      title: "Preparar montaje",
      priority: "HIGH"
    });
    expect(task.status()).toBe(201);
    const taskId = (await task.json()).id;

    const completedTask = await authorizedPatch(`/organizations/${organizationId}/events/${eventId}/tasks/${taskId}`, {
      title: "Preparar montaje",
      status: "COMPLETED",
      priority: "HIGH"
    });
    expect(completedTask.status()).toBe(200);
    expect((await completedTask.json()).status).toBe("COMPLETED");

    for (const transition of ["confirm", "start", "complete"]) {
      const response = await authorizedPost(`/organizations/${organizationId}/events/${eventId}/${transition}`, {});
      expect(response.status()).toBe(200);
    }

    const calendar = await authorizedGet(`/organizations/${organizationId}/events/calendar?from=2026-08-01T00:00:00.000Z&to=2026-08-31T23:59:59.000Z`);
    expect(calendar.status()).toBe(200);
    expect((await calendar.json()).some((item) => item.id === eventId)).toBe(true);
  });

  test("logs out and rejects refresh with cleared cookie", async () => {
    const logout = await api.post("/api/auth/logout");
    expect(logout.status()).toBe(200);
    expect(logout.headers()["set-cookie"]).toContain("kaklen_refresh_token=");

    const refresh = await api.post("/api/auth/refresh");
    expect(refresh.status()).toBe(401);
  });

  async function authorizedGet(path) {
    return api.get(`/api${path}`, { headers: authHeaders() });
  }

  async function authorizedPost(path, data) {
    return api.post(`/api${path}`, { data, headers: authHeaders() });
  }

  async function authorizedPatch(path, data) {
    return api.patch(`/api${path}`, { data, headers: authHeaders() });
  }

  function authHeaders() {
    return { Authorization: `Bearer ${accessToken}` };
  }
});

async function waitForReady(api) {
  const deadline = Date.now() + 120_000;
  let lastStatus = 0;
  while (Date.now() < deadline) {
    try {
      const response = await api.get("/api/health/ready");
      lastStatus = response.status();
      if (response.ok()) return;
    } catch {
      lastStatus = 0;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`API did not become ready. Last status: ${lastStatus}`);
}

async function expectRuntimeConfig(request, locale) {
  const response = await request.get(`${webBase}/${locale}/runtime-config.json`);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const body = await response.json();
  expect(body.version).toBeTruthy();
  expect(body.commitSha).toBeTruthy();
  expect(body.buildTime).toBeTruthy();
  expect(body.environment).toBeTruthy();
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}
