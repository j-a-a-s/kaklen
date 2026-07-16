import { expect, test } from "@playwright/test";
import { clearDemoData, createDemoPrismaClient, seedDemoData } from "../scripts/demo-data.mjs";

const apiBase = process.env.E2E_API_BASE_URL ?? "http://localhost:3000";
const webBase = process.env.E2E_WEB_BASE_URL ?? "http://localhost:4200";
const password = "KaklenDemo2026!";
const profiles = [
  ["empresa.angela@demo.kaklen.local", "Ángela Producciones Demo SpA", "198.51.100.21"],
  ["empresa.koke@demo.kaklen.local", "Koke Parfum Demo SpA", "198.51.100.22"],
  ["carolina.mendez@demo.kaklen.local", "Servicios Carolina Méndez", "198.51.100.23"],
  ["tomas.rivera@demo.kaklen.local", "Producciones Tomás Rivera", "198.51.100.24"]
];

test.describe.serial("deterministic multi-tenant demo dataset", () => {
  test.setTimeout(120_000);
  const tenants = [];

  test.beforeAll(async ({ playwright }) => {
    const prisma = createDemoPrismaClient();
    try {
      await clearDemoData(prisma);
      await seedDemoData(prisma);
    } finally {
      await prisma.$disconnect();
    }

    for (const [email, organizationName, forwardedFor] of profiles) {
      const context = await playwright.request.newContext({
        baseURL: apiBase,
        extraHTTPHeaders: { Origin: webBase, "X-Forwarded-For": forwardedFor }
      });
      const login = await context.post("/api/auth/login", { data: { email, password } });
      expect(login.status(), `login ${email}`).toBe(200);
      const token = (await login.json()).accessToken;
      const organizationsResponse = await context.get("/api/organizations", { headers: bearer(token) });
      expect(organizationsResponse.status()).toBe(200);
      const organizations = await organizationsResponse.json();
      expect(organizations).toHaveLength(1);
      expect(organizations[0]).toMatchObject({ name: organizationName });
      const membersResponse = await context.get(`/api/organizations/${organizations[0].id}/members`, { headers: bearer(token) });
      expect(membersResponse.status()).toBe(200);
      expect(await membersResponse.json()).toEqual([
        expect.objectContaining({ email, role: "OWNER", status: "ACTIVE" })
      ]);
      tenants.push({ context, email, token, organization: organizations[0] });
    }
  });

  test.afterAll(async () => {
    await Promise.all(tenants.map((tenant) => tenant.context.dispose()));
  });

  test("allows all four owners to log in and exposes only their own organization", async () => {
    expect(tenants).toHaveLength(4);
    expect(new Set(tenants.map((tenant) => tenant.organization.id)).size).toBe(4);
    expect(tenants.map((tenant) => tenant.email)).toEqual(profiles.map(([email]) => email));
  });

  test("exposes exact client, catalog, quotation, and event counts per tenant", async () => {
    for (const tenant of tenants) {
      const organizationId = tenant.organization.id;
      const [clientsResponse, catalogResponse, quotationsResponse, eventsResponse] = await Promise.all([
        get(tenant, `/api/organizations/${organizationId}/clients?pageSize=100`),
        get(tenant, `/api/organizations/${organizationId}/catalog?pageSize=100`),
        get(tenant, `/api/organizations/${organizationId}/quotations?pageSize=100`),
        get(tenant, `/api/organizations/${organizationId}/events?pageSize=100`)
      ]);
      for (const response of [clientsResponse, catalogResponse, quotationsResponse, eventsResponse]) {
        expect(response.status(), `${tenant.email} ${response.url()}`).toBe(200);
      }
      const clients = await clientsResponse.json();
      const catalog = await catalogResponse.json();
      const quotations = await quotationsResponse.json();
      const events = await eventsResponse.json();
      expect(clients.total).toBe(10);
      expect(clients.items.filter((client) => client.type === "NATURAL_PERSON")).toHaveLength(5);
      expect(clients.items.filter((client) => client.type === "LEGAL_ENTITY")).toHaveLength(5);
      expect(catalog.total).toBe(12);
      expect(catalog.items.filter((item) => item.type === "PRODUCT")).toHaveLength(6);
      expect(catalog.items.filter((item) => item.type === "SERVICE")).toHaveLength(6);
      expect(quotations.total).toBe(8);
      expect(countBy(quotations.items, "status")).toEqual({ DRAFT: 2, SENT: 2, APPROVED: 2, REJECTED: 1, CANCELLED: 1 });
      expect(quotations.items.some((quotation) => quotation.version === 2)).toBe(true);
      expect(events.total).toBe(5);
      expect(events.items.filter((event) => event.quotationId)).toHaveLength(2);
    }
  });

  test("returns the tenant-safe not-found policy for foreign resource identifiers", async () => {
    const owner = tenants[0];
    const foreign = tenants[1];
    const ownOrganizationId = owner.organization.id;
    const foreignOrganizationId = foreign.organization.id;
    const [foreignClients, foreignCatalog, foreignQuotations, foreignEvents] = await Promise.all([
      get(foreign, `/api/organizations/${foreignOrganizationId}/clients?pageSize=1`),
      get(foreign, `/api/organizations/${foreignOrganizationId}/catalog?pageSize=1`),
      get(foreign, `/api/organizations/${foreignOrganizationId}/quotations?pageSize=1`),
      get(foreign, `/api/organizations/${foreignOrganizationId}/events?pageSize=1`)
    ]);
    const clientId = (await foreignClients.json()).items[0].id;
    const catalogItemId = (await foreignCatalog.json()).items[0].id;
    const quotationId = (await foreignQuotations.json()).items[0].id;
    const eventId = (await foreignEvents.json()).items[0].id;

    const crossTenantResponses = await Promise.all([
      get(owner, `/api/organizations/${ownOrganizationId}/clients/${clientId}`),
      get(owner, `/api/organizations/${ownOrganizationId}/catalog/${catalogItemId}`),
      get(owner, `/api/organizations/${ownOrganizationId}/quotations/${quotationId}`),
      get(owner, `/api/organizations/${ownOrganizationId}/events/${eventId}`)
    ]);
    for (const response of crossTenantResponses) {
      expect([403, 404]).toContain(response.status());
    }

    const foreignOrganization = await get(owner, `/api/organizations/${foreignOrganizationId}`);
    expect([403, 404]).toContain(foreignOrganization.status());
  });

  function get(tenant, path) {
    return tenant.context.get(path, { headers: bearer(tenant.token) });
  }
});

function bearer(token) {
  return { Authorization: `Bearer ${token}` };
}

function countBy(items, property) {
  return items.reduce((counts, item) => {
    counts[item[property]] = (counts[item[property]] ?? 0) + 1;
    return counts;
  }, {});
}
