import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Prisma } from "@prisma/client";
import {
  assertDemoEnvironment,
  buildDemoDataset,
  deterministicUuid,
  fingerprintDemoDataset,
  isManagedDemoOrganization,
  isValidRut,
  managedDemoMarkers
} from "./demo-data.mjs";

test("builds the four requested demo owners and organizations", () => {
  const dataset = buildDemoDataset();
  assert.deepEqual(
    dataset.organizations.map((bundle) => [bundle.definition.accountName, bundle.user.email, bundle.organization.name, bundle.definition.organizationType]),
    [
      ["Ángela Producciones Demo", "empresa.angela@demo.kaklen.local", "Ángela Producciones Demo SpA", "LEGAL_ENTITY"],
      ["Koke Parfum Demo", "empresa.koke@demo.kaklen.local", "Koke Parfum Demo SpA", "LEGAL_ENTITY"],
      ["Carolina Méndez", "carolina.mendez@demo.kaklen.local", "Servicios Carolina Méndez", "NATURAL_PERSON"],
      ["Tomás Rivera", "tomas.rivera@demo.kaklen.local", "Producciones Tomás Rivera", "NATURAL_PERSON"]
    ]
  );
  for (const bundle of dataset.organizations) {
    assert.equal(bundle.membership.role, "OWNER");
    assert.equal(bundle.membership.status, "ACTIVE");
    assert.equal(bundle.organization.country, "CL");
    assert.equal(bundle.organization.currency, "CLP");
    assert.equal(bundle.organization.timezone, "America/Santiago");
  }
});

test("is deterministic and idempotent at the logical dataset level", () => {
  const first = buildDemoDataset();
  const second = buildDemoDataset();
  assert.equal(first.baseDate.toISOString(), "2026-07-01T12:00:00.000Z");
  assert.equal(fingerprintDemoDataset(first), fingerprintDemoDataset(second));
  assert.deepEqual(first, second);
  assert.deepEqual(first.counts, {
    users: 4,
    organizations: 4,
    clients: 40,
    interactions: 76,
    catalogItems: 48,
    quotations: 32,
    quotationItems: 120,
    events: 20,
    eventTasks: 100,
    eventParticipants: 80,
    eventResources: 80,
    eventTimelineEntries: 84
  });
  const source = readFileSync(new URL("./demo-data.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Date\.now\s*\(/);
});

test("generates unique normalized RUT values accepted by the canonical validator", () => {
  const dataset = buildDemoDataset();
  const values = dataset.organizations.flatMap((bundle) => [bundle.organization.taxId, ...bundle.clients.map((client) => client.taxId)]);
  assert.equal(values.length, 44);
  assert.equal(new Set(values).size, values.length);
  for (const value of values) {
    assert.match(value, /^\d{8}[0-9K]$/);
    assert.equal(isValidRut(value), true);
  }
});

test("creates ten contextual clients and one to three prior interactions per organization", () => {
  const dataset = buildDemoDataset();
  for (const bundle of dataset.organizations) {
    assert.equal(bundle.clients.length, 10);
    assert.equal(bundle.clients.filter((client) => client.type === "NATURAL_PERSON").length, 5);
    assert.equal(bundle.clients.filter((client) => client.type === "LEGAL_ENTITY").length, 5);
    for (const client of bundle.clients) {
      assert.ok(client.email.endsWith("@demo.kaklen.local"));
      assert.match(client.phone, /^\+56 9 /);
      assert.equal(client.whatsapp, client.phone);
      assert.ok(client.address);
      assert.ok(client.notes);
      assert.ok(client.interactions.length >= 1 && client.interactions.length <= 3);
      const relatedDates = [
        ...bundle.quotations.filter((quotation) => quotation.clientId === client.id).map((quotation) => quotation.issueDate),
        ...bundle.events.filter((event) => event.clientId === client.id).map((event) => event.startAt)
      ];
      const firstRelatedAt = relatedDates.sort((left, right) => left.getTime() - right.getTime())[0];
      assert.ok(client.interactions.every((interaction) => !firstRelatedAt || interaction.occurredAt < firstRelatedAt));
    }
  }
});

test("creates six products and six services tailored to every tenant", () => {
  const dataset = buildDemoDataset();
  const catalogSignatures = new Set();
  for (const bundle of dataset.organizations) {
    assert.equal(bundle.catalogItems.length, 12);
    assert.equal(bundle.catalogItems.filter((item) => item.type === "PRODUCT").length, 6);
    assert.equal(bundle.catalogItems.filter((item) => item.type === "SERVICE").length, 6);
    assert.ok(bundle.catalogItems.every((item) => item.code.startsWith(`DEMO-${bundle.definition.codePrefix}-`)));
    assert.ok(bundle.catalogItems.filter((item) => item.type === "PRODUCT").every((item) => item.trackInventory && item.sku));
    assert.ok(bundle.catalogItems.filter((item) => item.type === "SERVICE").every((item) => !item.trackInventory && item.sku === null));
    catalogSignatures.add(bundle.catalogItems.map((item) => item.name).join("|"));
  }
  assert.equal(catalogSignatures.size, 4);
});

test("creates valid quotation distributions, versions, snapshots, and totals", () => {
  const dataset = buildDemoDataset();
  for (const bundle of dataset.organizations) {
    const statuses = countBy(bundle.quotations, (quotation) => quotation.status);
    assert.deepEqual(statuses, { DRAFT: 2, SENT: 2, APPROVED: 2, REJECTED: 1, CANCELLED: 1 });
    assert.equal(bundle.quotations.length, 8);
    assert.ok(bundle.quotations.some((quotation) => quotation.version === 2));
    for (const quotation of bundle.quotations) {
      assert.ok(quotation.items.length >= 2 && quotation.items.length <= 6);
      assert.ok(quotation.validUntil >= quotation.issueDate);
      assert.equal(quotation.currency, "CLP");
      assert.equal(quotation.items.every((item) => bundle.catalogItems.some((catalogItem) => catalogItem.id === item.catalogItemId)), true);
      assert.equal(sum(quotation.items.map((item) => item.subtotal)).equals(quotation.subtotal), true);
      assert.equal(sum(quotation.items.map((item) => item.discountTotal)).equals(quotation.discountTotal), true);
      assert.equal(sum(quotation.items.map((item) => item.taxTotal)).equals(quotation.taxTotal), true);
      assert.equal(sum(quotation.items.map((item) => item.total)).equals(quotation.total), true);
      let status = "DRAFT";
      for (const transition of quotation.transitions) {
        assert.equal(transition.previousStatus, status);
        status = transition.newStatus;
      }
      assert.equal(status, quotation.status);
    }
  }
});

test("creates coherent events from approved quotations and manual operations", () => {
  const dataset = buildDemoDataset();
  for (const bundle of dataset.organizations) {
    assert.equal(bundle.events.length, 5);
    assert.deepEqual(countBy(bundle.events, (event) => event.status), {
      COMPLETED: 1,
      CONFIRMED: 1,
      DRAFT: 1,
      CANCELLED: 1,
      IN_PROGRESS: 1
    });
    const linked = bundle.events.filter((event) => event.quotationId);
    assert.equal(linked.length, 2);
    assert.equal(new Set(linked.map((event) => event.quotationId)).size, 2);
    for (const event of bundle.events) {
      assert.ok(event.tasks.length >= 3 && event.tasks.length <= 8);
      assert.ok(event.participants.length >= 2 && event.participants.length <= 6);
      assert.ok(event.resources.length >= 2 && event.resources.length <= 5);
      assert.ok(event.timeline.length >= 3 && event.timeline.length <= 6);
      assert.ok(event.endAt > event.startAt);
      assert.ok(event.tasks.every((task) => task.organizationId === bundle.organization.id && task.assignedUserId === bundle.user.id));
      assert.ok(event.resources.every((resource) => resource.organizationId === bundle.organization.id));
      if (event.quotationId) {
        const quotation = bundle.quotations.find((item) => item.id === event.quotationId);
        assert.equal(quotation.status, "APPROVED");
        assert.equal(quotation.clientId, event.clientId);
        assert.equal(event.resources.length, quotation.items.length);
      }
    }
  }
});

test("keeps every domain reference inside its tenant", () => {
  const dataset = buildDemoDataset();
  const tenantByResource = new Map();
  for (const bundle of dataset.organizations) {
    const organizationId = bundle.organization.id;
    const resourceIds = [
      bundle.organization.id,
      ...bundle.clients.flatMap((client) => [client.id, ...client.interactions.map((interaction) => interaction.id)]),
      ...bundle.catalogItems.map((item) => item.id),
      ...bundle.quotations.flatMap((quotation) => [quotation.id, ...quotation.items.map((item) => item.id)]),
      ...bundle.events.flatMap((event) => [
        event.id,
        ...event.tasks.map((task) => task.id),
        ...event.participants.map((participant) => participant.id),
        ...event.resources.map((resource) => resource.id),
        ...event.timeline.map((entry) => entry.id)
      ])
    ];
    for (const resourceId of resourceIds) {
      assert.equal(tenantByResource.has(resourceId), false, `duplicate resource ${resourceId}`);
      tenantByResource.set(resourceId, organizationId);
    }
    assert.ok(bundle.quotations.every((quotation) => bundle.clients.some((client) => client.id === quotation.clientId)));
    assert.ok(bundle.events.every((event) => bundle.clients.some((client) => client.id === event.clientId)));
  }
  assert.equal(tenantByResource.size > 0, true);
});

test("rejects production and refuses lookalike organizations during selective clear", () => {
  assert.throws(() => assertDemoEnvironment({ NODE_ENV: "production" }), /no pueden ejecutarse en production/);
  assert.doesNotThrow(() => assertDemoEnvironment({ NODE_ENV: "development" }));
  const marker = managedDemoMarkers()[0];
  const managed = { ...marker, createdByUserId: marker.userId, createdBy: { email: marker.email } };
  assert.equal(isManagedDemoOrganization(managed), true);
  assert.equal(isManagedDemoOrganization({ ...managed, id: deterministicUuid("foreign-organization") }), false);
  assert.equal(isManagedDemoOrganization({ ...managed, createdBy: { email: "real@example.com" } }), false);
  assert.equal(isManagedDemoOrganization({ ...managed, slug: "real-organization" }), false);
});

test("quality graph seeds and verifies demo data once before E2E", () => {
  const source = readFileSync(new URL("./quality-pipeline-core.mjs", import.meta.url), "utf8");
  const seed = source.indexOf('defineTask("demo-seed"');
  const verify = source.indexOf('defineTask("demo-verify"');
  const e2e = source.indexOf('defineTask("e2e"');
  assert.ok(seed >= 0 && verify > seed && e2e > verify);
  assert.equal(source.match(/defineTask\("demo-seed"/g)?.length, 1);
  assert.equal(source.match(/defineTask\("demo-verify"/g)?.length, 1);
});

function countBy(items, selector) {
  return items.reduce((counts, item) => {
    const key = selector(item);
    counts[key] = (counts[key] ?? 0) + 1;
    return counts;
  }, {});
}

function sum(values) {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0)).toDecimalPlaces(2);
}
