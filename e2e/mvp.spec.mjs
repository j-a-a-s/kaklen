import { expect, test } from "@playwright/test";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";

test.describe.serial("Kaklen MVP core workflow", () => {
  test.setTimeout(180_000);

  let api;
  let accessToken = "";
  let organizationId = "";
  let clientId = "";
  let productId = "";
  let quotationId = "";
  let eventId = "";

  test.beforeAll(async ({ playwright }, testInfo) => {
    testInfo.setTimeout(180_000);
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: {
        Origin: webBase
      }
    });
    await waitForReady(api);
  });

  test.afterAll(async () => {
    await api?.dispose();
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

  test("registers, refreshes, and loads current user", async () => {
    const unique = Date.now();
    const response = await api.post("/api/auth/register", {
      data: {
        email: `mvp-${unique}@kaklen.local`,
        firstName: "MVP",
        lastName: "Tester",
        password: "KaklenTest123!"
      }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()["set-cookie"]).toContain("HttpOnly");

    const body = await response.json();
    accessToken = body.accessToken;
    expect(body.user.email).toContain("@kaklen.local");
    expect(body.user.locale).toBe("es");

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
    expect(update.status()).toBe(400);

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
      country: "CL"
    });
    expect(invalidRut.status()).toBe(400);

    const createNatural = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "NATURAL_PERSON",
      status: "ACTIVE",
      firstName: "Ángela",
      lastName: "Pérez",
      email: "angela.mvp@kaklen.local",
      country: "CL"
    });
    expect(createNatural.status()).toBe(201);
    clientId = (await createNatural.json()).id;

    const createCompany = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "LEGAL_ENTITY",
      status: "ACTIVE",
      legalName: "Empresa MVP SpA",
      taxId: "12.345.678-5",
      country: "CL"
    });
    expect(createCompany.status()).toBe(201);

    const duplicateRut = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "LEGAL_ENTITY",
      legalName: "Empresa Duplicada SpA",
      taxId: "12.345.678-5",
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

  test("creates, sends, approves, and versions a quotation", async () => {
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

    const send = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/send`, {
      note: "E2E send"
    });
    expect(send.status()).toBe(200);
    expect((await send.json()).status).toBe("SENT");

    const approve = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/approve`, {
      note: "E2E approve"
    });
    expect(approve.status()).toBe(200);
    expect((await approve.json()).status).toBe("APPROVED");

    const version = await authorizedPost(`/organizations/${organizationId}/quotations/${quotationId}/new-version`, {});
    expect(version.status()).toBe(200);
    expect((await version.json()).version).toBe(2);
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
