import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { currencyFractionDigits, formatMoney, moneyToMinorUnits } from "../packages/shared/dist/index.js";
import { clearMailpit, waitForMailpitEmail } from "./support/mailpit.mjs";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const mailpitBase = process.env.E2E_MAILPIT_BASE_URL ?? "http://localhost:8025";
const forwardedFor = `198.51.100.${20 + (process.pid % 200)}`;
const verificationUrlPattern = /https?:\/\/[^\s"<>]+\/(?:es|en|pt-BR)\/verify-email\?token=[A-Za-z0-9_-]+/;

test.describe.serial("Kaklen MVP core workflow", () => {
  test.setTimeout(180_000);

  let api;
  let mailpit;
  let prisma;
  let accessToken = "";
  let organizationId = "";
  let otherOrganizationId = "";
  let clientId = "";
  let productId = "";
  let quotationId = "";
  let publicToken = "";
  let checkoutToken = "";
  let eventId = "";
  let accountEmail = "";
  const accountPassword = "KaklenTest123!";
  let browserLoginSequence = 0;

  test.beforeAll(async ({ playwright }, testInfo) => {
    testInfo.setTimeout(180_000);
    api = await playwright.request.newContext({
      baseURL: apiBase,
      extraHTTPHeaders: {
        Origin: webBase,
        "X-Forwarded-For": forwardedFor
      }
    });
    mailpit = await playwright.request.newContext({ baseURL: mailpitBase });
    prisma = new PrismaClient();
    await prisma.$connect();
    await clearMailpit(mailpit);
    await waitForReady(api);
  });

  test.afterAll(async () => {
    await api?.dispose();
    await mailpit?.dispose();
    await prisma?.$disconnect();
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

  test("shows login email as required in es en and pt-BR", async ({ page }) => {
    for (const locale of ["es", "en", "pt-BR"]) {
      await page.goto(`${webBase}/${locale}/login`);
      const email = page.locator("#login-email");
      const field = email.locator("..");

      await expect(email).toHaveAttribute("aria-required", "true");
      await expect(field.locator(".required-indicator")).toBeVisible();
      await expect(field.locator(".optional-label")).toHaveCount(0);

      await page.locator('form button[type="submit"]').click();
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await expect(field.locator(".field-error")).toBeVisible();

      await email.fill("invalid-email");
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await email.fill("valid@example.com");
      await email.blur();
      await expect(email).toHaveAttribute("aria-invalid", "false");
    }
  });

  test("registers pending, verifies, logs in, refreshes, and loads current user", async () => {
    const unique = Date.now();
    accountEmail = `mvp-${unique}@kaklen.local`;
    const response = await api.post("/api/auth/register", {
      data: {
        email: accountEmail,
        firstName: "MVP",
        lastName: "Tester",
        password: accountPassword
      }
    });
    expect(response.status()).toBe(201);
    expect(response.headers()["set-cookie"]).toBeUndefined();

    expect(await response.json()).toEqual({
      message: "Cuenta creada. Revisa tu correo para confirmar tu dirección."
    });
    const delivered = await waitForMailpitEmail(mailpit, {
      recipient: accountEmail,
      subject: "Confirma tu cuenta de Kaklen",
      urlPattern: verificationUrlPattern
    });
    const token = new URL(delivered.url).searchParams.get("token");
    const verification = await api.post("/api/auth/verify-email", { data: { token } });
    expect(verification.status()).toBe(200);

    const login = await api.post("/api/auth/login", {
      data: { email: accountEmail, password: accountPassword }
    });
    expect(login.status()).toBe(200);
    const body = await login.json();
    accessToken = body.accessToken;
    expect(body.user.email).toBe(accountEmail);
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

    const isolationOrganization = await authorizedPost("/organizations", {
      name: `MVP Isolation ${unique}`,
      country: "CL",
      currency: "CLP",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });
    expect(isolationOrganization.status()).toBe(201);
    otherOrganizationId = (await isolationOrganization.json()).id;
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

  test("repairs draft parity explicitly and blocks non-repairable financial corruption", async ({ page }) => {
    await ensureParityContext();
    const createQuotation = async (currency, unitPrice) => {
      const response = await authorizedPost(`/organizations/${organizationId}/quotations`, {
        clientId,
        issueDate: "2026-07-18",
        validUntil: "2026-08-31",
        currency,
        items: [{
          type: "CUSTOM",
          name: `Parity ${currency}`,
          quantity: "1",
          unit: "unit",
          unitPrice,
          discountType: "NONE",
          discountValue: "0",
          taxPercent: "0"
        }]
      });
      expect(response.status()).toBe(201);
      return response.json();
    };

    const clp = await createQuotation("CLP", "1000");
    const corruptClpTotal = (BigInt(clp.total) + 1n).toString();
    await prisma.quotation.update({ where: { id: clp.id }, data: { total: corruptClpTotal } });
    try {
      const detail = await authorizedGet(`/organizations/${organizationId}/quotations/${clp.id}`);
      expect(detail.status()).toBe(409);
      expect(await detail.json()).toEqual({
        code: "QUOTATION_MONEY_MISMATCH",
        message: "Quotation totals are inconsistent.",
        statusCode: 409,
        field: "total",
        resourceId: clp.id,
        repairable: true
      });

      const list = await authorizedGet(`/organizations/${organizationId}/quotations?page=1&pageSize=20`);
      expect(list.status()).toBe(409);
      expect(await list.json()).toMatchObject({
        code: "QUOTATION_MONEY_MISMATCH",
        field: "total",
        resourceId: clp.id,
        repairable: true
      });

      await authenticatePage(page, `/organizations/${organizationId}/quotations`);
      await expect(page.getByText("Detectamos una inconsistencia financiera.", { exact: true })).toBeVisible();
      await expect(page.locator("kaklen-quotation-list .entity-price")).toHaveCount(0);
      await expect(page.locator("kaklen-quotation-list .item-row")).toHaveCount(0);

      await navigateSpa(page, `/organizations/${organizationId}/quotations/${clp.id}/edit`);
      await expect(page.getByText("Detectamos una inconsistencia financiera.", { exact: true })).toBeVisible();
      await expect(page.locator("kaklen-quotation-form .quotation-wizard-layout")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Guardar cotización" })).toHaveCount(0);

      await navigateSpa(page, `/organizations/${organizationId}/quotations/${clp.id}`);
      await expect(page.getByText(
        "Detectamos una inconsistencia financiera.",
        { exact: true }
      )).toBeVisible();
      await expect(page.locator("kaklen-quotation-detail .quotation-line-financial")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Más acciones" })).toHaveCount(0);
      await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
      await page.getByRole("button", { name: "Recalcular totales" }).click();
      const repairDialog = page.getByRole("alertdialog");
      await expect(repairDialog).toBeVisible();
      await repairDialog.getByRole("button", { name: "Recalcular totales" }).click();
      await expect(page.getByText("Totales recalculados correctamente.", { exact: true })).toBeVisible();
      await expect(page.locator("kaklen-quotation-detail .quotation-line-financial").first()).toBeVisible();
      await page.getByRole("button", { name: "Más acciones" }).click();
      await expect(page.getByRole("menuitem", { name: "Descargar PDF" })).toBeVisible();

      const repairedDetail = await authorizedGet(`/organizations/${organizationId}/quotations/${clp.id}`);
      expect(repairedDetail.status()).toBe(200);
      expect((await repairedDetail.json()).total).toBe(clp.total);
      expect((await authorizedGet(`/organizations/${organizationId}/quotations?page=1&pageSize=20`)).status()).toBe(200);
    } finally {
      await prisma.quotation.update({ where: { id: clp.id }, data: { total: clp.total } });
    }

    const usd = await createQuotation("USD", "100.00");
    await prisma.quotation.update({ where: { id: usd.id }, data: { total: "100.01" } });
    try {
      const detail = await authorizedGet(`/organizations/${organizationId}/quotations/${usd.id}`);
      expect(detail.status()).toBe(409);
      expect(await detail.json()).toMatchObject({
        code: "QUOTATION_MONEY_MISMATCH",
        field: "total",
        resourceId: usd.id,
        repairable: true
      });

      const isolated = await authorizedGet(`/organizations/${otherOrganizationId}/quotations/${usd.id}`);
      expect(isolated.status()).toBe(404);
      const isolatedRepair = await authorizedPost(
        `/organizations/${otherOrganizationId}/quotations/${usd.id}/recalculate-totals`,
        {}
      );
      expect(isolatedRepair.status()).toBe(404);

      const repair = await authorizedPost(`/organizations/${organizationId}/quotations/${usd.id}/recalculate-totals`, {});
      expect(repair.status()).toBe(200);
      expect(moneyToMinorUnits((await repair.json()).total, "USD")).toBe("10000");

      const sent = await authorizedPost(`/organizations/${organizationId}/quotations/${usd.id}/send`, {});
      expect(sent.status()).toBe(200);
      await prisma.quotation.update({ where: { id: usd.id }, data: { total: "100.01" } });
      const blockedRepair = await authorizedPost(`/organizations/${organizationId}/quotations/${usd.id}/recalculate-totals`, {});
      expect(blockedRepair.status()).toBe(409);
      expect(await blockedRepair.json()).toMatchObject({
        code: "QUOTATION_MONEY_REPAIR_NOT_ALLOWED",
        field: "status",
        resourceId: usd.id,
        repairable: false
      });
    } finally {
      await prisma.quotation.update({ where: { id: usd.id }, data: { total: usd.total } });
    }

    expect((await authorizedGet(`/organizations/${organizationId}/quotations/${usd.id}`)).status()).toBe(200);

    const approved = await createQuotation("CLP", "2000");
    expect((await authorizedPost(`/organizations/${organizationId}/quotations/${approved.id}/send`, {})).status()).toBe(200);
    expect((await authorizedPost(`/organizations/${organizationId}/quotations/${approved.id}/approve`, {})).status()).toBe(200);
    await prisma.quotation.update({ where: { id: approved.id }, data: { total: "2001" } });
    try {
      const summary = await authorizedGet(`/organizations/${organizationId}/quotations/summary`);
      expect(summary.status()).toBe(409);
      expect(await summary.json()).toMatchObject({
        code: "QUOTATION_MONEY_MISMATCH",
        field: "total",
        resourceId: approved.id,
        repairable: false
      });
    } finally {
      await prisma.quotation.update({ where: { id: approved.id }, data: { total: approved.total } });
    }
  });

  test("persists and exposes the exact CLP discount fixtures", async () => {
    const issueDate = "2026-07-17";
    const validUntil = "2026-08-31";
    const baseItems = [
      { type: "PRODUCT", code: "LED-P3", name: "Pantalla LED P3", quantity: "2", unit: "unidad", unitPrice: "210000.00", discountType: "NONE", discountValue: "0", taxPercent: "19" },
      { type: "SERVICE", code: "PROD-INTEGRAL", name: "Producción integral de eventos", quantity: "1", unit: "servicio", unitPrice: "520000", discountType: "NONE", discountValue: "0", taxPercent: "19" },
      { type: "SERVICE", code: "CATERING", name: "Catering para invitados", quantity: "19", unit: "persona", unitPrice: "24900", discountType: "NONE", discountValue: "0", taxPercent: "19" }
    ];
    const invalidFraction = await authorizedPost(`/organizations/${organizationId}/quotations`, {
      clientId,
      issueDate,
      validUntil,
      currency: "CLP",
      items: [{ ...baseItems[0], quantity: "1", unitPrice: "1000.50" }]
    });
    expect(invalidFraction.status()).toBe(400);
    expect(await invalidFraction.json()).toMatchObject({ code: "CLP_FRACTION_NOT_ALLOWED" });

    let payableQuotationId = "";
    for (const fixture of exactClpFixtures(baseItems)) {
      const response = await authorizedPost(`/organizations/${organizationId}/quotations`, {
        clientId,
        issueDate,
        validUntil,
        currency: "CLP",
        globalDiscountPercent: fixture.globalDiscountPercent,
        items: fixture.items
      });
      expect(response.status(), fixture.name).toBe(201);
      const created = await response.json();
      expect(created).toMatchObject({
        subtotal: fixture.expected.subtotal,
        discountTotal: fixture.expected.discountTotal,
        taxTotal: fixture.expected.taxTotal,
        total: fixture.expected.total
      });
      expect(created.items.map((item) => item.total)).toEqual(fixture.expected.lineTotals);

      const persisted = await authorizedGet(`/organizations/${organizationId}/quotations/${created.id}`);
      expect(persisted.status()).toBe(200);
      expect(await persisted.json()).toMatchObject({ total: fixture.expected.total });
      if (fixture.name === "line and overall discounts") payableQuotationId = created.id;
    }

    const link = await authorizedPost(`/organizations/${organizationId}/quotations/${payableQuotationId}/public-link`, {
      locale: "es"
    });
    expect(link.status()).toBe(201);
    const token = (await link.json()).publicToken;
    const portal = await api.get(`/api/portal/quotations/${token}`);
    expect(portal.status()).toBe(200);
    const portalBody = await portal.json();
    expect(portalBody).toMatchObject({
      quotation: {
        subtotal: "1413100",
        lineDiscountTotal: "26000",
        globalDiscountTotal: "13871",
        discountTotal: "39871",
        taxableBase: "1373229",
        taxTotal: "260913",
        total: "1634142"
      }
    });
    expect(portalBody.quotation.items.map((item) => item.total)).toEqual(["494802", "581981", "557359"]);
    expect(portalBody.quotation.items.reduce((sum, item) => sum + BigInt(item.total), 0n).toString()).toBe("1634142");

    const payment = await api.post(`/api/portal/quotations/${token}/payments`, {
      data: { idempotencyKey: crypto.randomUUID(), locale: "es" }
    });
    expect(payment.status()).toBe(201);
    expect(await payment.json()).toMatchObject({ amount: "1634142", currency: "CLP" });

    const pdf = await authorizedGet(`/organizations/${organizationId}/quotations/${payableQuotationId}/pdf?locale=es`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 4).toString("ascii")).toBe("%PDF");
  });

  test("keeps approved quotation KPIs separated by currency", async ({ page }) => {
    const baselineResponse = await authorizedGet(`/organizations/${organizationId}/quotations/summary`);
    expect(baselineResponse.status()).toBe(200);
    const baseline = await baselineResponse.json();
    const approvedFixtures = [
      ["CLP", "100000"],
      ["CLP", "50000"],
      ["USD", "500.25"],
      ["EUR", "100.50"],
      ["BRL", "800.00"]
    ];
    for (const [currency, unitPrice] of approvedFixtures) {
      const create = await authorizedPost(`/organizations/${organizationId}/quotations`, {
        clientId,
        issueDate: "2026-07-17",
        validUntil: "2026-08-31",
        currency,
        items: [{
          type: "CUSTOM",
          name: `Approved ${currency} ${unitPrice}`,
          quantity: "1",
          unit: "unit",
          unitPrice,
          discountType: "NONE",
          discountValue: "0",
          taxPercent: "0"
        }]
      });
      expect(create.status()).toBe(201);
      const quotation = await create.json();
      expect((await authorizedPost(`/organizations/${organizationId}/quotations/${quotation.id}/send`, {})).status()).toBe(200);
      expect((await authorizedPost(`/organizations/${organizationId}/quotations/${quotation.id}/approve`, {})).status()).toBe(200);
    }

    const summary = await authorizedGet(`/organizations/${organizationId}/quotations/summary`);
    expect(summary.status()).toBe(200);
    const summaryBody = await summary.json();
    const baselineClp = baseline.approvedAmounts.find((item) => item.currency === "CLP");
    const expectedClpAmount = addMoney(baselineClp?.amount ?? "0", "150000", "CLP");
    const expectedClpCount = (baselineClp?.quotationCount ?? 0) + 2;
    expect(summaryBody).toMatchObject({
      baseCurrency: "CLP",
      baseCurrencyApprovedAmount: expectedClpAmount,
      approvedAmounts: expect.arrayContaining([
        { currency: "CLP", amount: expectedClpAmount, quotationCount: expectedClpCount },
        { currency: "BRL", amount: "800.00", quotationCount: 1 },
        { currency: "EUR", amount: "100.50", quotationCount: 1 },
        { currency: "USD", amount: "500.25", quotationCount: 1 }
      ])
    });
    const isolatedSummary = await authorizedGet(`/organizations/${otherOrganizationId}/quotations/summary`);
    expect(isolatedSummary.status()).toBe(200);
    expect(await isolatedSummary.json()).toMatchObject({
      baseCurrency: "CLP",
      baseCurrencyApprovedAmount: "0",
      approvedAmounts: []
    });

    await authenticatePage(page, `/organizations/${organizationId}/quotations`);
    await expect(page.getByText("Aprobado en moneda base", { exact: true })).toBeVisible();
    await expect(page.getByText(`${formatMoney(expectedClpAmount, "CLP", "es-CL")} CLP`, { exact: true })).toBeVisible();
    await expect(page.getByText("BRL 800,00", { exact: true })).toBeVisible();
    await expect(page.getByText("EUR 100,50", { exact: true })).toBeVisible();
    await expect(page.getByText("USD 500,25", { exact: true })).toBeVisible();
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

  test("completes the secure quotation, customer feedback, payment, notification, and provider flow", async ({ page }) => {
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

    const changeComment = "Solicito descuentos para los servicios seleccionados.";
    await page.goto(`${webBase}/es/p/quotations/${publicToken}`);
    const lineBreakdown = page.locator(".portal-item-money").first();
    for (const label of ["Subtotal neto", "Descuento por línea", "Descuento global asignado", "Descuento total", "Base imponible", "IVA", "Total línea, IVA incluido"]) {
      await expect(lineBreakdown.getByText(label, { exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "Solicitar cambios" }).click();
    await page.getByRole("checkbox", { name: "Seleccionar para solicitar cambios" }).first().check();
    await page.getByLabel("Comentario").fill(changeComment);
    const changesPromise = page.waitForResponse((response) =>
      response.url().endsWith(`/api/portal/quotations/${publicToken}/change-requests`) &&
      response.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    const changes = await changesPromise;
    expect(changes.status()).toBe(201);
    expect((await changes.json()).status).toBe("CHANGES_REQUESTED");

    const internalRequests = await authorizedGet(
      `/organizations/${organizationId}/quotations/${quotationId}/change-requests`
    );
    expect(internalRequests.status()).toBe(200);
    expect(await internalRequests.json()).toEqual([
      expect.objectContaining({
        quotationId,
        quotationVersion: 1,
        comment: changeComment,
        itemIndexes: [0],
        items: [expect.objectContaining({ index: 0, name: "Producto MVP", code: "MVP-PRODUCT" })]
      })
    ]);
    const crossedRequests = await authorizedGet(
      `/organizations/${otherOrganizationId}/quotations/${quotationId}/change-requests`
    );
    expect(crossedRequests.status()).toBe(404);

    const feedbackNotifications = await authorizedGet(`/organizations/${organizationId}/notifications`);
    expect(feedbackNotifications.status()).toBe(200);
    const feedbackNotification = (await feedbackNotifications.json()).find((notification) =>
      notification.type === "QUOTATION_CHANGES_REQUESTED" && notification.resourceId === quotationId
    );
    expect(feedbackNotification).toMatchObject({
      body: changeComment,
      route: `/organizations/${organizationId}/quotations/${quotationId}#change-requests`
    });

    await authenticatePage(page, `/organizations/${organizationId}/quotations/${quotationId}`);
    await expect(page.locator("#change-requests")).toContainText(changeComment);
    await expect(page.locator("#change-requests")).toContainText("Versión v1");
    await expect(page.locator("#change-requests")).toContainText("Producto MVP");
    await expect(page.locator("#change-requests small")).toContainText(/Enviada .*\d/);
    await expect(page.locator("#change-requests").getByRole("button", { name: "Crear nueva versión" })).toBeVisible();
    await expect(page.getByText("El cliente solicitó cambios. Revisa el comentario antes de crear una nueva versión.", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Abrir notificaciones" }).click();
    const notificationItem = page.locator(".notification-item").filter({ hasText: changeComment });
    await expect(notificationItem).toBeVisible();
    await notificationItem.click();
    await expect(page).toHaveURL(new RegExp(`/quotations/${quotationId}#change-requests$`));
    await expect(page.locator("#change-requests")).toHaveClass(/change-requests-highlighted/);
    const notificationsAfterOpen = await authorizedGet(`/organizations/${organizationId}/notifications`);
    const openedFeedback = (await notificationsAfterOpen.json()).find((notification) => notification.id === feedbackNotification.id);
    expect(openedFeedback.readAt).toBeTruthy();

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

  test("renders the localized public quotation without horizontal overflow", async ({ page }) => {
    const viewports = responsiveViewports();

    for (const locale of ["es", "en", "pt-BR"]) {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto(`${webBase}/${locale}/p/quotations/${publicToken}`);
      await expect(page.locator("kaklen-public-quotation")).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }

    await page.goto(`${webBase}/es/p/quotations/${publicToken}`);
    await expect(page.locator("kaklen-public-quotation")).toBeVisible();
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await expectNoHorizontalOverflow(page);
      const financialLabels = page.locator("kaklen-public-quotation .quotation-line-financial dt");
      await expect(financialLabels.first()).toBeVisible();
      const financialLabelSizes = await financialLabels.evaluateAll((elements) =>
        elements.map((element) => Number.parseFloat(getComputedStyle(element).fontSize))
      );
      expect(financialLabelSizes.length).toBeGreaterThan(0);
      expect(financialLabelSizes.every((size) => size >= 11)).toBe(true);
    }
  });

  test("renders the internal quotation detail without horizontal overflow", async ({ page }) => {
    await authenticatePage(page, `/organizations/${organizationId}/quotations/${quotationId}`);
    await expect(page.locator("kaklen-quotation-detail")).toBeVisible({ timeout: 30_000 });
    for (const viewport of responsiveViewports()) {
      await page.setViewportSize(viewport);
      await expect(page.locator("kaklen-quotation-detail .quotation-line-financial").first()).toBeVisible();
      await expectNoHorizontalOverflow(page);
    }
  });

  test("renders the payment checkout without horizontal overflow", async ({ page }) => {
    await page.goto(`${webBase}/es/p/payments/${checkoutToken}`);
    await expect(page.locator("kaklen-payment-checkout")).toBeVisible();
    for (const viewport of responsiveViewports()) {
      await page.setViewportSize(viewport);
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

  async function ensureParityContext() {
    if (accessToken && organizationId && otherOrganizationId && clientId) return;
    const unique = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    accountEmail = `parity-${unique}@kaklen.local`;
    const register = await api.post("/api/auth/register", {
      data: {
        email: accountEmail,
        firstName: "Parity",
        lastName: "Tester",
        password: accountPassword
      }
    });
    expect(register.status()).toBe(201);
    const delivered = await waitForMailpitEmail(mailpit, {
      recipient: accountEmail,
      subject: "Confirma tu cuenta de Kaklen",
      urlPattern: verificationUrlPattern
    });
    const verificationToken = new URL(delivered.url).searchParams.get("token");
    expect(verificationToken).toBeTruthy();
    expect((await api.post("/api/auth/verify-email", { data: { token: verificationToken } })).status()).toBe(200);
    const login = await api.post("/api/auth/login", {
      data: { email: accountEmail, password: accountPassword }
    });
    expect(login.status()).toBe(200);
    accessToken = (await login.json()).accessToken;

    const primary = await authorizedPost("/organizations", {
      name: `Parity Primary ${unique}`,
      country: "US",
      currency: "CLP",
      timezone: "UTC",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });
    expect(primary.status()).toBe(201);
    organizationId = (await primary.json()).id;
    const isolated = await authorizedPost("/organizations", {
      name: `Parity Isolated ${unique}`,
      country: "US",
      currency: "CLP",
      timezone: "UTC",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });
    expect(isolated.status()).toBe(201);
    otherOrganizationId = (await isolated.json()).id;
    const client = await authorizedPost(`/organizations/${organizationId}/clients`, {
      type: "NATURAL_PERSON",
      status: "ACTIVE",
      firstName: "Parity",
      lastName: "Client",
      email: `client-${unique}@kaklen.local`,
      taxId: "11.111.111-1",
      whatsapp: "+56911111111",
      country: "CL"
    });
    expect(client.status()).toBe(201);
    clientId = (await client.json()).id;
  }

  async function authenticatePage(page, route = "/dashboard") {
    browserLoginSequence += 1;
    const browserForwardedFor = `203.0.113.${20 + ((process.pid + browserLoginSequence) % 200)}`;
    const login = await page.request.post(`${apiBase}/api/auth/login`, {
      data: { email: accountEmail, password: accountPassword },
      headers: {
        Origin: webBase,
        "X-Forwarded-For": browserForwardedFor
      }
    });
    expect(login.status()).toBe(200);
    const refreshResponsePromise = page.waitForResponse(
      (response) => response.url() === `${apiBase}/api/auth/refresh` && response.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.goto(`${webBase}/es${route}`);
    expect((await refreshResponsePromise).status()).toBe(200);
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
  await expect.poll(async () => {
    try {
      const response = await api.get("/api/health/ready");
      return response.status();
    } catch {
      return 0;
    }
  }, {
    message: "API did not become ready",
    timeout: 120_000,
    intervals: [100, 250, 500, 1_000]
  }).toBe(200);
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

async function navigateSpa(page, route) {
  const localizedRoute = `/es${route}`;
  await page.evaluate((path) => {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, localizedRoute);
  await expect(page).toHaveURL(new RegExp(`${localizedRoute.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await page.locator("main").last().waitFor();
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
}

function responsiveViewports() {
  return [
    { width: 320, height: 568 },
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1366, height: 768 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 }
  ];
}

function exactClpFixtures(baseItems) {
  return [
    {
      name: "no discounts",
      globalDiscountPercent: "0",
      items: baseItems,
      expected: {
        subtotal: "1413100", discountTotal: "0", taxTotal: "268489", total: "1681589",
        lineTotals: ["499800", "618800", "562989"]
      }
    },
    {
      name: "overall discount",
      globalDiscountPercent: "1",
      items: baseItems,
      expected: {
        subtotal: "1413100", discountTotal: "14131", taxTotal: "265804", total: "1664773",
        lineTotals: ["494802", "612612", "557359"]
      }
    },
    {
      name: "line and overall discounts",
      globalDiscountPercent: "1",
      items: baseItems.map((item, index) => index === 1
        ? { ...item, discountType: "PERCENTAGE", discountValue: "5" }
        : item),
      expected: {
        subtotal: "1413100", discountTotal: "39871", taxTotal: "260913", total: "1634142",
        lineTotals: ["494802", "581981", "557359"]
      }
    }
  ];
}

function addMoney(left, right, currency) {
  const fractionDigits = currencyFractionDigits(currency);
  const minorUnits = BigInt(moneyToMinorUnits(left, currency)) + BigInt(moneyToMinorUnits(right, currency));
  if (fractionDigits === 0) return minorUnits.toString();
  const factor = 10n ** BigInt(fractionDigits);
  const whole = minorUnits / factor;
  const fraction = String(minorUnits % factor).padStart(fractionDigits, "0");
  return `${whole}.${fraction}`;
}
