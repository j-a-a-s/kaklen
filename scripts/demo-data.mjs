import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Prisma, PrismaClient } from "@prisma/client";
import { DEMO_BASE_ISO, DEMO_ORGANIZATIONS, DEMO_PASSWORD, LEGACY_DEMO_SLUGS } from "./demo-definitions.mjs";
import { loadLocalEnv, readDatabaseUrl } from "./local-db-utils.mjs";

const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const argon2 = requireApi("argon2");
const {
  createChileanRut,
  formatChileanRut,
  isValidChileanRut,
  normalizeChileanRut
} = requireApi("@kaklen/shared/chilean-rut");

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const DATASET_VERSION = "multi-tenant-demo-v2";
const QUOTATION_TRANSITIONS = {
  DRAFT: ["SENT", "CANCELLED"],
  SENT: ["APPROVED", "REJECTED", "CANCELLED", "DRAFT"],
  APPROVED: [],
  REJECTED: [],
  EXPIRED: [],
  CANCELLED: []
};
const EVENT_TRANSITIONS = {
  DRAFT: ["CONFIRMED", "CANCELLED", "ARCHIVED"],
  CONFIRMED: ["IN_PROGRESS", "CANCELLED", "ARCHIVED"],
  IN_PROGRESS: ["COMPLETED", "CANCELLED", "ARCHIVED"],
  COMPLETED: ["ARCHIVED"],
  CANCELLED: ["ARCHIVED"],
  ARCHIVED: []
};
const QUOTATION_PLANS = [
  { key: "draft-primary", number: 1, version: 1, status: "DRAFT", clientIndex: 0, itemCount: 2, issueOffset: -100 },
  { key: "sent-version-source", number: 2, version: 1, status: "SENT", clientIndex: 1, itemCount: 3, issueOffset: -92 },
  { key: "sent-secondary", number: 3, version: 1, status: "SENT", clientIndex: 2, itemCount: 4, issueOffset: -84 },
  { key: "approved-primary", number: 4, version: 1, status: "APPROVED", clientIndex: 3, itemCount: 4, issueOffset: -76 },
  { key: "approved-secondary", number: 5, version: 1, status: "APPROVED", clientIndex: 4, itemCount: 5, issueOffset: -68 },
  { key: "rejected", number: 6, version: 1, status: "REJECTED", clientIndex: 5, itemCount: 6, issueOffset: -60 },
  { key: "cancelled", number: 7, version: 1, status: "CANCELLED", clientIndex: 6, itemCount: 3, issueOffset: -52 },
  { key: "draft-version", number: 2, version: 2, status: "DRAFT", sourceKey: "sent-version-source", issueOffset: -44 }
];
const EVENT_PLANS = [
  { status: "COMPLETED", startOffset: -35, durationHours: 8, quotationKey: "approved-primary" },
  { status: "CONFIRMED", startOffset: 21, durationHours: 8, quotationKey: "approved-secondary" },
  { status: "DRAFT", startOffset: 75, durationHours: 7, clientIndex: 7 },
  { status: "CANCELLED", startOffset: -10, durationHours: 6, clientIndex: 8 },
  { status: "IN_PROGRESS", startOffset: 14, durationHours: 8, clientIndex: 9 }
];
const INTERACTION_TYPES = ["CALL", "EMAIL", "MEETING", "NOTE", "WHATSAPP"];
const INTERACTION_COPY = {
  CALL: ["Llamada de descubrimiento", "Se revisaron necesidades, alcance y próximos pasos."],
  EMAIL: ["Envío de antecedentes", "Se enviaron antecedentes y una propuesta de agenda."],
  MEETING: ["Reunión comercial", "Se acordaron prioridades, responsables y fecha de seguimiento."],
  NOTE: ["Seguimiento comercial", "Nota de seguimiento con acuerdos y oportunidades detectadas."],
  WHATSAPP: ["Confirmación por WhatsApp", "Se confirmó disponibilidad y canal de contacto preferido."]
};
const TASK_TITLES = [
  "Confirmar alcance con cliente",
  "Validar proveedores y recursos",
  "Preparar plan operativo",
  "Coordinar accesos y montaje",
  "Revisar programa y responsables",
  "Ejecutar prueba técnica",
  "Cerrar operación y evidencias"
];
const TIMELINE_TITLES = ["Acceso al recinto", "Montaje", "Prueba técnica", "Recepción", "Inicio de actividad", "Cierre operativo"];

export { DEMO_BASE_ISO, DEMO_ORGANIZATIONS, DEMO_PASSWORD };

export function deterministicUuid(key) {
  const hash = createHash("sha256").update(`kaklen-demo:${key}`).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20)}`;
}

export function formatRut(base) {
  return formatChileanRut(createChileanRut(base));
}

export function isValidRut(value) {
  return isValidChileanRut(value);
}

export function assertDemoEnvironment(env = loadLocalEnv()) {
  const environments = [env.NODE_ENV, env.PUBLIC_APP_ENVIRONMENT, env.APP_ENVIRONMENT]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toLowerCase());
  if (environments.includes("production")) {
    throw new Error("Los comandos de datos demo no pueden ejecutarse en production.");
  }
}

export function buildDemoDataset() {
  const baseDate = new Date(DEMO_BASE_ISO);
  const organizations = DEMO_ORGANIZATIONS.map((definition, organizationIndex) => {
    const userId = deterministicUuid(`user:${definition.email}`);
    const organizationId = deterministicUuid(`organization:${definition.slug}`);
    const userCreatedAt = addDays(baseDate, -260);
    const organizationCreatedAt = addDays(baseDate, -250);
    const user = {
      id: userId,
      email: definition.email,
      firstName: definition.firstName,
      lastName: definition.lastName,
      locale: "es",
      status: "ACTIVE",
      createdAt: userCreatedAt,
      updatedAt: userCreatedAt
    };
    const organization = {
      id: organizationId,
      name: definition.organizationName,
      slug: definition.slug,
      legalName: definition.legalName,
      taxId: createChileanRut(definition.rutBody),
      country: "CL",
      currency: "CLP",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es",
      defaultLocale: "es",
      status: "ACTIVE",
      createdByUserId: userId,
      createdAt: organizationCreatedAt,
      updatedAt: organizationCreatedAt,
      deletedAt: null
    };
    const membership = {
      id: deterministicUuid(`membership:${organizationId}:${userId}`),
      organizationId,
      userId,
      role: "OWNER",
      status: "ACTIVE",
      joinedAt: organizationCreatedAt,
      createdAt: organizationCreatedAt,
      updatedAt: organizationCreatedAt
    };
    const clients = buildClients(definition, organizationIndex, organizationId, userId, baseDate);
    const catalogItems = buildCatalog(definition, organizationId, userId, baseDate);
    const quotations = buildQuotations(definition, organizationId, userId, clients, catalogItems, baseDate);
    const events = buildEvents(definition, organizationId, userId, clients, catalogItems, quotations, baseDate);
    return { definition, user, organization, membership, clients, catalogItems, quotations, events };
  });

  return {
    version: DATASET_VERSION,
    baseDate,
    organizations,
    counts: datasetCounts(organizations)
  };
}

export function fingerprintDemoDataset(dataset = buildDemoDataset()) {
  const serialized = JSON.stringify(dataset, (_key, value) => {
    if (Prisma.Decimal.isDecimal(value)) return value.toFixed();
    return value;
  });
  return createHash("sha256").update(serialized).digest("hex");
}

export function managedDemoMarkers() {
  const current = DEMO_ORGANIZATIONS.map((definition) => ({
    id: deterministicUuid(`organization:${definition.slug}`),
    slug: definition.slug,
    userId: deterministicUuid(`user:${definition.email}`),
    email: definition.email
  }));
  const legacy = LEGACY_DEMO_SLUGS.map((legacyDefinition) => ({
    id: deterministicUuid(`organization:${legacyDefinition.slug}`),
    slug: legacyDefinition.slug,
    userId: deterministicUuid(`user:${legacyDefinition.email}`),
    email: legacyDefinition.email
  }));
  const unique = new Map([...current, ...legacy].map((marker) => [`${marker.id}:${marker.slug}`, marker]));
  return [...unique.values()];
}

export function isManagedDemoOrganization(candidate) {
  return managedDemoMarkers().some(
    (marker) =>
      candidate.id === marker.id &&
      candidate.slug === marker.slug &&
      candidate.createdByUserId === marker.userId &&
      candidate.createdBy?.email === marker.email
  );
}

export async function seedDemoData(prisma, env = loadLocalEnv()) {
  assertDemoEnvironment(env);
  const dataset = buildDemoDataset();
  const passwordHashes = await preparePasswordHashes(prisma, dataset.organizations);

  await prisma.$transaction(
    async (tx) => {
      await removeManagedDemoOrganizations(tx);
      for (const bundle of dataset.organizations) {
        await seedOrganizationBundle(tx, bundle, passwordHashes.get(bundle.user.id));
      }
    },
    { maxWait: 15_000, timeout: 180_000 }
  );

  const verification = await verifyDemoData(prisma, env);
  if (!verification.ok) {
    throw new Error(`El dataset demo fue creado, pero no superó la verificación:\n${verification.errors.join("\n")}`);
  }
  return { counts: verification.counts, fingerprint: fingerprintDemoDataset(dataset) };
}

export async function clearDemoData(prisma, env = loadLocalEnv()) {
  assertDemoEnvironment(env);
  return prisma.$transaction(
    async (tx) => {
      const organizations = await removeManagedDemoOrganizations(tx);
      let users = 0;
      for (const definition of DEMO_ORGANIZATIONS) {
        const expectedId = deterministicUuid(`user:${definition.email}`);
        const candidates = await tx.user.findMany({
          where: { OR: [{ id: expectedId }, { email: definition.email }] },
          select: { id: true, email: true }
        });
        for (const candidate of candidates) {
          if (candidate.id !== expectedId || candidate.email !== definition.email) {
            throw new Error(`Limpieza cancelada: la identidad ${definition.email} no coincide con el marcador demo esperado.`);
          }
          const externalReferences = await countUserDomainReferences(tx, candidate.id);
          if (externalReferences > 0) {
            throw new Error(`Limpieza cancelada: ${definition.email} conserva ${externalReferences} referencias fuera del dataset demo.`);
          }
          await tx.user.delete({ where: { id: candidate.id } });
          users += 1;
        }
      }
      return { organizations, users };
    },
    { maxWait: 15_000, timeout: 120_000 }
  );
}

export async function verifyDemoData(prisma, env = loadLocalEnv()) {
  assertDemoEnvironment(env);
  const dataset = buildDemoDataset();
  const expectedUserIds = dataset.organizations.map((bundle) => bundle.user.id);
  const expectedOrganizationIds = dataset.organizations.map((bundle) => bundle.organization.id);
  const expectedEmails = dataset.organizations.map((bundle) => bundle.user.email);
  const expectedSlugs = dataset.organizations.map((bundle) => bundle.organization.slug);
  const [users, organizations, clients, interactions, catalogItems, quotations, events, auditLogs, markedOrganizations] = await Promise.all([
    prisma.user.findMany({
      where: { OR: [{ id: { in: expectedUserIds } }, { email: { in: expectedEmails } }] },
      include: { organizationMemberships: true, createdOrganizations: true }
    }),
    prisma.organization.findMany({ where: { OR: [{ id: { in: expectedOrganizationIds } }, { slug: { in: expectedSlugs } }] } }),
    prisma.client.findMany({ where: { organizationId: { in: expectedOrganizationIds } } }),
    prisma.clientInteraction.findMany({
      where: { organizationId: { in: expectedOrganizationIds } },
      include: { client: true, user: true }
    }),
    prisma.catalogItem.findMany({ where: { organizationId: { in: expectedOrganizationIds } } }),
    prisma.quotation.findMany({
      where: { organizationId: { in: expectedOrganizationIds } },
      include: { client: true, items: true, history: { orderBy: { createdAt: "asc" } } }
    }),
    prisma.event.findMany({
      where: { organizationId: { in: expectedOrganizationIds } },
      include: {
        client: true,
        quotation: { include: { items: true } },
        tasks: true,
        participants: { include: { user: true, client: true } },
        resources: { include: { catalogItem: true } },
        timeline: true
      }
    }),
    prisma.organizationAuditLog.findMany({ where: { organizationId: { in: expectedOrganizationIds } } }),
    prisma.organization.findMany({
      where: { OR: managedDemoMarkers().flatMap((marker) => [{ id: marker.id }, { slug: marker.slug }]) },
      include: { createdBy: { select: { email: true } } }
    })
  ]);

  const issues = createIssueCollector();
  const expected = indexExpectedDataset(dataset);
  verifyTopLevelCounts(issues, dataset.counts, { users, organizations, clients, interactions, catalogItems, quotations, events });
  await verifyUsersAndOrganizations(issues, expected, users, organizations, markedOrganizations);
  verifyClientsAndInteractions(issues, expected, clients, interactions, quotations, events);
  verifyCatalog(issues, expected, catalogItems);
  verifyQuotations(issues, expected, quotations, catalogItems);
  verifyEvents(issues, expected, events);
  verifyAuditLogs(issues, expected, auditLogs);

  const errors = Object.values(issues.groups).flat();
  return {
    ok: errors.length === 0,
    errors,
    counts: {
      users: users.length,
      organizations: organizations.length,
      clients: clients.length,
      catalogItems: catalogItems.length,
      quotations: quotations.length,
      events: events.length
    },
    checks: {
      ruts: issues.groups.ruts.length === 0,
      passwords: issues.groups.passwords.length === 0,
      totals: issues.groups.totals.length === 0,
      relationships: issues.groups.relationships.length === 0,
      isolation: issues.groups.isolation.length === 0,
      states: issues.groups.states.length === 0,
      orphans: issues.orphanCount
    },
    fingerprint: fingerprintDemoDataset(dataset)
  };
}

export function createDemoPrismaClient() {
  return new PrismaClient({ datasourceUrl: readDatabaseUrl(loadLocalEnv()) });
}

function buildClients(definition, organizationIndex, organizationId, userId, baseDate) {
  const statuses = ["ACTIVE", "ACTIVE", "LEAD", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "ACTIVE", "INACTIVE", "LEAD"];
  return definition.clients.map((clientDefinition, clientIndex) => {
    const id = deterministicUuid(`client:${organizationId}:${clientIndex}`);
    const createdAt = addDays(baseDate, -230 + clientIndex * 2);
    const isCompany = clientDefinition.type === "LEGAL_ENTITY";
    const taxBody = isCompany
      ? 77_200_000 + organizationIndex * 100 + clientIndex
      : 18_600_000 + organizationIndex * 100 + clientIndex;
    const displayName = isCompany
      ? clientDefinition.tradeName
      : `${clientDefinition.firstName} ${clientDefinition.lastName}`;
    const phoneSuffix = String(6200 + organizationIndex * 100 + clientIndex).padStart(4, "0");
    const phone = `+56 9 ${phoneSuffix} ${String(1000 + clientIndex).padStart(4, "0")}`;
    const interactions = Array.from({ length: 1 + (clientIndex % 3) }, (_value, interactionIndex) => {
      const type = INTERACTION_TYPES[(organizationIndex + clientIndex + interactionIndex) % INTERACTION_TYPES.length];
      const [subject, description] = INTERACTION_COPY[type];
      const occurredAt = addHours(addDays(baseDate, -190 + clientIndex * 4 + interactionIndex), organizationIndex);
      return {
        id: deterministicUuid(`interaction:${id}:${interactionIndex}`),
        organizationId,
        clientId: id,
        userId,
        type,
        subject,
        description,
        occurredAt,
        createdAt: occurredAt
      };
    });
    return {
      id,
      organizationId,
      type: clientDefinition.type,
      status: statuses[clientIndex],
      displayName,
      firstName: isCompany ? null : clientDefinition.firstName,
      lastName: isCompany ? null : clientDefinition.lastName,
      legalName: isCompany ? clientDefinition.legalName : null,
      taxId: createChileanRut(taxBody),
      email: `cliente.${definition.key}.${String(clientIndex + 1).padStart(2, "0")}@demo.kaklen.local`,
      phone,
      whatsapp: clientIndex % 2 === 0 ? phone : null,
      country: "CL",
      region: "Metropolitana de Santiago",
      city: clientDefinition.city,
      address: `Avenida Demo ${definition.codePrefix} ${100 + clientIndex}`,
      notes: clientDefinition.notes,
      createdByUserId: userId,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null,
      interactions
    };
  });
}

function buildCatalog(definition, organizationId, userId, baseDate) {
  return definition.catalog.map((catalogDefinition, index) => {
    const id = deterministicUuid(`catalog:${organizationId}:${index}`);
    const createdAt = addDays(baseDate, -215 + index);
    return {
      id,
      organizationId,
      type: catalogDefinition.type,
      status: "ACTIVE",
      sku: catalogDefinition.type === "PRODUCT" ? `DEMO-${definition.codePrefix}-SKU-${String(index + 1).padStart(3, "0")}` : null,
      code: `DEMO-${definition.codePrefix}-${catalogDefinition.code}`,
      name: catalogDefinition.name,
      description: catalogDefinition.description,
      unit: catalogDefinition.unit,
      cost: money(catalogDefinition.cost),
      price: money(catalogDefinition.price),
      taxPercent: money("19"),
      currency: "CLP",
      trackInventory: catalogDefinition.type === "PRODUCT",
      createdByUserId: userId,
      createdAt,
      updatedAt: createdAt,
      archivedAt: null
    };
  });
}

function buildQuotations(definition, organizationId, userId, clients, catalogItems, baseDate) {
  const quotations = [];
  const byKey = new Map();
  for (const [planIndex, plan] of QUOTATION_PLANS.entries()) {
    const source = plan.sourceKey ? byKey.get(plan.sourceKey) : null;
    if (plan.sourceKey && !source) {
      throw new Error(`La cotización fuente ${plan.sourceKey} no fue construida.`);
    }
    const id = deterministicUuid(`quotation:${organizationId}:${plan.number}:v${plan.version}`);
    const issueDate = addDays(baseDate, plan.issueOffset);
    const clientId = source?.clientId ?? clients[plan.clientIndex].id;
    const rawItems = source
      ? source.items.map((item) => ({ ...item }))
      : buildQuotationItems(catalogItems, planIndex, plan.itemCount);
    const items = rawItems.map((item, itemIndex) => ({
      ...item,
      id: deterministicUuid(`quotation-item:${id}:${itemIndex}`),
      quotationId: id,
      sortOrder: itemIndex + 1
    }));
    const transitions = quotationTransitionPlan(plan.status, issueDate);
    const sentAt = transitions.find((transition) => transition.newStatus === "SENT")?.at ?? null;
    const approvedAt = transitions.find((transition) => transition.newStatus === "APPROVED")?.at ?? null;
    const rejectedAt = transitions.find((transition) => transition.newStatus === "REJECTED")?.at ?? null;
    const quotation = {
      id,
      key: plan.key,
      organizationId,
      clientId,
      number: `DEMO-${definition.codePrefix}-Q-${String(plan.number).padStart(3, "0")}`,
      version: plan.version,
      status: plan.status,
      issueDate,
      validUntil: addDays(issueDate, 30),
      currency: "CLP",
      subtotal: sum(items.map((item) => item.subtotal)),
      discountTotal: sum(items.map((item) => item.discountTotal)),
      taxTotal: sum(items.map((item) => item.taxTotal)),
      total: sum(items.map((item) => item.total)),
      notes: source ? "Versión revisada a partir de la propuesta enviada." : `Propuesta demo para ${clients.find((client) => client.id === clientId)?.displayName}.`,
      terms: "Valores netos más impuestos. Coordinación sujeta a disponibilidad y confirmación escrita.",
      createdByUserId: userId,
      approvedAt,
      rejectedAt,
      sentAt,
      createdAt: issueDate,
      updatedAt: transitions.at(-1)?.at ?? issueDate,
      archivedAt: null,
      items,
      transitions
    };
    quotations.push(quotation);
    byKey.set(plan.key, quotation);
  }
  return quotations;
}

function buildQuotationItems(catalogItems, planIndex, itemCount) {
  return Array.from({ length: itemCount }, (_value, itemIndex) => {
    const catalogItem = catalogItems[(planIndex + itemIndex * 5) % catalogItems.length];
    const quantity = quantityFor(catalogItem, planIndex, itemIndex);
    const discountType = itemIndex === 1 && planIndex % 2 === 1 ? "PERCENTAGE" : itemIndex === 2 && planIndex % 3 === 0 ? "FIXED" : "NONE";
    const discountValue = discountType === "PERCENTAGE" ? money("5") : discountType === "FIXED" ? money("5000") : money("0");
    const subtotal = money(quantity.mul(catalogItem.price));
    const discountTotal =
      discountType === "PERCENTAGE"
        ? money(subtotal.mul(discountValue).div(100))
        : discountType === "FIXED"
          ? Prisma.Decimal.min(discountValue, subtotal)
          : money("0");
    const taxableBase = subtotal.sub(discountTotal);
    const taxTotal = money(taxableBase.mul(catalogItem.taxPercent).div(100));
    return {
      catalogItemId: catalogItem.id,
      type: catalogItem.type,
      code: catalogItem.code,
      name: catalogItem.name,
      description: catalogItem.description,
      quantity,
      unit: catalogItem.unit,
      unitPrice: catalogItem.price,
      discountType,
      discountValue,
      taxPercent: catalogItem.taxPercent,
      subtotal,
      discountTotal,
      taxTotal,
      total: money(taxableBase.add(taxTotal))
    };
  });
}

function buildEvents(definition, organizationId, userId, clients, catalogItems, quotations, baseDate) {
  const quotationByKey = new Map(quotations.map((quotation) => [quotation.key, quotation]));
  return EVENT_PLANS.map((plan, eventIndex) => {
    const quotation = plan.quotationKey ? quotationByKey.get(plan.quotationKey) : null;
    if (plan.quotationKey && (!quotation || quotation.status !== "APPROVED")) {
      throw new Error(`El evento demo requiere una cotización aprobada: ${plan.quotationKey}`);
    }
    const id = deterministicUuid(`event:${organizationId}:${eventIndex}`);
    const startAt = addDays(baseDate, plan.startOffset);
    const endAt = addHours(startAt, plan.durationHours);
    const createdAt = addDays(startAt, -30);
    const clientId = quotation?.clientId ?? clients[plan.clientIndex].id;
    const client = clients.find((item) => item.id === clientId);
    const transitions = eventTransitionPlan(plan.status, createdAt, startAt, endAt);
    const resources = buildEventResources(id, organizationId, quotation, catalogItems, eventIndex, createdAt);
    const tasks = buildEventTasks(id, organizationId, userId, plan.status, eventIndex, createdAt, startAt, endAt);
    const participants = buildEventParticipants(id, organizationId, userId, client, eventIndex, createdAt);
    const timeline = buildEventTimeline(id, organizationId, eventIndex, createdAt, startAt);
    return {
      id,
      organizationId,
      clientId,
      quotationId: quotation?.id ?? null,
      code: `DEMO-${definition.codePrefix}-EV-${String(eventIndex + 1).padStart(3, "0")}`,
      name: definition.events[eventIndex].name,
      description: definition.events[eventIndex].description,
      status: plan.status,
      startAt,
      endAt,
      timezone: "America/Santiago",
      venueName: definition.events[eventIndex].venueName,
      address: definition.events[eventIndex].address,
      city: definition.events[eventIndex].city,
      region: "Metropolitana de Santiago",
      country: "CL",
      contactName: client.displayName,
      contactEmail: client.email,
      contactPhone: client.phone,
      budget: quotation?.total ?? money(480_000 + eventIndex * 95_000),
      currency: "CLP",
      notes: definition.events[eventIndex].notes,
      createdByUserId: userId,
      createdAt,
      updatedAt: transitions.at(-1)?.at ?? createdAt,
      archivedAt: null,
      transitions,
      tasks,
      participants,
      resources,
      timeline
    };
  });
}

function buildEventTasks(eventId, organizationId, userId, eventStatus, eventIndex, createdAt, startAt, endAt) {
  const count = 3 + eventIndex;
  return Array.from({ length: count }, (_value, taskIndex) => {
    let status = "PENDING";
    if (eventStatus === "COMPLETED") status = "COMPLETED";
    if (eventStatus === "CANCELLED") status = "CANCELLED";
    if (eventStatus === "IN_PROGRESS") {
      status = taskIndex < 2 ? "COMPLETED" : taskIndex === 2 ? "IN_PROGRESS" : "PENDING";
    }
    const taskCreatedAt = addHours(createdAt, taskIndex + 1);
    return {
      id: deterministicUuid(`event-task:${eventId}:${taskIndex}`),
      organizationId,
      eventId,
      title: TASK_TITLES[taskIndex],
      description: `Tarea operativa ${taskIndex + 1} del evento demo.`,
      status,
      priority: ["HIGH", "MEDIUM", "URGENT", "MEDIUM"][taskIndex % 4],
      assignedUserId: userId,
      dueAt: addDays(startAt, -(count - taskIndex)),
      completedAt: status === "COMPLETED" ? (eventStatus === "COMPLETED" ? endAt : startAt) : null,
      createdByUserId: userId,
      createdAt: taskCreatedAt,
      updatedAt: status === "COMPLETED" ? (eventStatus === "COMPLETED" ? endAt : startAt) : taskCreatedAt
    };
  });
}

function buildEventParticipants(eventId, organizationId, userId, client, eventIndex, createdAt) {
  const count = 2 + eventIndex;
  return Array.from({ length: count }, (_value, participantIndex) => {
    const base = {
      id: deterministicUuid(`event-participant:${eventId}:${participantIndex}`),
      organizationId,
      eventId,
      userId: null,
      clientId: null,
      externalName: null,
      externalEmail: null,
      externalPhone: null,
      role: "STAFF",
      notes: "Participante del dataset demo.",
      createdAt: addHours(createdAt, participantIndex + 1)
    };
    if (participantIndex === 0) {
      return { ...base, userId, role: "OWNER", notes: "Responsable principal de la organización." };
    }
    if (participantIndex === 1) {
      return { ...base, clientId: client.id, role: "CLIENT_CONTACT", notes: "Contacto principal del cliente." };
    }
    const externalNumber = participantIndex - 1;
    return {
      ...base,
      externalName: `Participante Demo ${externalNumber}`,
      externalEmail: `participante.${eventIndex + 1}.${externalNumber}@demo.kaklen.local`,
      externalPhone: `+56 9 7100 ${String(eventIndex * 10 + externalNumber).padStart(4, "0")}`,
      role: ["COORDINATOR", "STAFF", "SUPPLIER", "GUEST"][externalNumber % 4]
    };
  });
}

function buildEventResources(eventId, organizationId, quotation, catalogItems, eventIndex, createdAt) {
  const sourceItems = quotation
    ? quotation.items
    : Array.from({ length: 2 + (eventIndex % 4) }, (_value, resourceIndex) => catalogItems[(eventIndex * 2 + resourceIndex) % catalogItems.length]);
  return sourceItems.map((source, resourceIndex) => {
    const catalogItem = quotation ? catalogItems.find((item) => item.id === source.catalogItemId) : source;
    return {
      id: deterministicUuid(`event-resource:${eventId}:${resourceIndex}`),
      organizationId,
      eventId,
      catalogItemId: catalogItem.id,
      name: quotation ? source.name : catalogItem.name,
      quantity: quotation ? source.quantity : new Prisma.Decimal(resourceIndex + 1),
      unit: quotation ? source.unit : catalogItem.unit,
      unitCost: quotation ? source.unitPrice : catalogItem.cost,
      notes: quotation ? "Recurso generado desde snapshot de cotización aprobada." : "Recurso manual del catálogo demo.",
      createdAt: addHours(createdAt, resourceIndex + 1),
      updatedAt: addHours(createdAt, resourceIndex + 1)
    };
  });
}

function buildEventTimeline(eventId, organizationId, eventIndex, createdAt, startAt) {
  const count = 3 + (eventIndex % 4);
  return Array.from({ length: count }, (_value, timelineIndex) => {
    const startsAt = addHours(startAt, -3 + timelineIndex * 2);
    return {
      id: deterministicUuid(`event-timeline:${eventId}:${timelineIndex}`),
      organizationId,
      eventId,
      title: TIMELINE_TITLES[timelineIndex],
      description: `Hito ${timelineIndex + 1} del cronograma operativo.`,
      startsAt,
      endsAt: addHours(startsAt, 1),
      sortOrder: timelineIndex + 1,
      createdAt: addHours(createdAt, timelineIndex + 1),
      updatedAt: addHours(createdAt, timelineIndex + 1)
    };
  });
}

async function preparePasswordHashes(prisma, bundles) {
  const hashes = new Map();
  for (const bundle of bundles) {
    const candidates = await prisma.user.findMany({
      where: { OR: [{ id: bundle.user.id }, { email: bundle.user.email }] },
      select: { id: true, email: true, passwordHash: true }
    });
    if (candidates.some((candidate) => candidate.id !== bundle.user.id || candidate.email !== bundle.user.email)) {
      throw new Error(`Seed cancelado: ${bundle.user.email} colisiona con una identidad no administrada por el dataset demo.`);
    }
    const existing = candidates[0];
    const validExistingHash = existing ? await verifiesPassword(existing.passwordHash) : false;
    hashes.set(
      bundle.user.id,
      validExistingHash ? existing.passwordHash : await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id })
    );
  }
  return hashes;
}

async function seedOrganizationBundle(tx, bundle, passwordHash) {
  if (!passwordHash) throw new Error(`No se generó passwordHash para ${bundle.user.email}.`);
  await tx.user.upsert({
    where: { email: bundle.user.email },
    create: { ...bundle.user, passwordHash },
    update: { ...without(bundle.user, ["id", "email"]), passwordHash }
  });
  await tx.organization.create({ data: bundle.organization });
  await tx.organizationMembership.create({ data: bundle.membership });

  for (const client of bundle.clients) {
    await tx.client.create({ data: without(client, ["interactions"]) });
    await tx.clientInteraction.createMany({ data: client.interactions });
    await writeAudit(tx, bundle, "client.created", "client", client.id, client.createdAt);
  }
  for (const catalogItem of bundle.catalogItems) {
    await tx.catalogItem.create({ data: catalogItem });
    await writeAudit(tx, bundle, "catalog.created", "catalog_item", catalogItem.id, catalogItem.createdAt);
  }
  for (const quotation of bundle.quotations) {
    await seedQuotation(tx, bundle, quotation);
  }
  for (const event of bundle.events) {
    await seedEvent(tx, bundle, event);
  }
}

async function seedQuotation(tx, bundle, quotation) {
  await tx.quotation.create({
    data: {
      ...without(quotation, ["key", "items", "transitions", "status", "sentAt", "approvedAt", "rejectedAt", "updatedAt"]),
      status: "DRAFT",
      sentAt: null,
      approvedAt: null,
      rejectedAt: null,
      updatedAt: quotation.createdAt
    }
  });
  await tx.quotationItem.createMany({ data: quotation.items });
  await tx.quotationStatusHistory.create({
    data: {
      id: deterministicUuid(`quotation-history:${quotation.id}:draft`),
      organizationId: quotation.organizationId,
      quotationId: quotation.id,
      previousStatus: null,
      newStatus: "DRAFT",
      changedByUserId: quotation.createdByUserId,
      note: "quotation.created",
      createdAt: quotation.createdAt
    }
  });
  await writeAudit(tx, bundle, "quotation.created", "quotation", quotation.id, quotation.createdAt);

  let currentStatus = "DRAFT";
  for (const [transitionIndex, transition] of quotation.transitions.entries()) {
    if (!QUOTATION_TRANSITIONS[currentStatus].includes(transition.newStatus) || transition.previousStatus !== currentStatus) {
      throw new Error(`Transición de cotización inválida en ${quotation.number}: ${currentStatus} -> ${transition.newStatus}`);
    }
    await tx.quotation.update({
      where: { id: quotation.id },
      data: {
        status: transition.newStatus,
        sentAt: transition.newStatus === "SENT" ? transition.at : undefined,
        approvedAt: transition.newStatus === "APPROVED" ? transition.at : undefined,
        rejectedAt: transition.newStatus === "REJECTED" ? transition.at : undefined,
        updatedAt: transition.at
      }
    });
    await tx.quotationStatusHistory.create({
      data: {
        id: deterministicUuid(`quotation-history:${quotation.id}:${transitionIndex}:${transition.newStatus}`),
        organizationId: quotation.organizationId,
        quotationId: quotation.id,
        previousStatus: transition.previousStatus,
        newStatus: transition.newStatus,
        changedByUserId: quotation.createdByUserId,
        note: `quotation.${transition.newStatus.toLowerCase()}`,
        createdAt: transition.at
      }
    });
    await writeAudit(tx, bundle, `quotation.${transition.newStatus.toLowerCase()}`, "quotation", quotation.id, transition.at, transitionIndex);
    currentStatus = transition.newStatus;
  }
  if (currentStatus !== quotation.status) {
    throw new Error(`La cotización ${quotation.number} terminó en ${currentStatus} y debía terminar en ${quotation.status}.`);
  }
}

async function seedEvent(tx, bundle, event) {
  await tx.event.create({
    data: {
      ...without(event, ["transitions", "tasks", "participants", "resources", "timeline", "status", "updatedAt"]),
      status: "DRAFT",
      updatedAt: event.createdAt
    }
  });
  await tx.eventTask.createMany({ data: event.tasks });
  await tx.eventParticipant.createMany({ data: event.participants });
  await tx.eventResource.createMany({ data: event.resources });
  await tx.eventTimelineEntry.createMany({ data: event.timeline });
  await writeAudit(tx, bundle, event.quotationId ? "event.created_from_quotation" : "event.created", "event", event.id, event.createdAt);

  let currentStatus = "DRAFT";
  for (const [transitionIndex, transition] of event.transitions.entries()) {
    if (!EVENT_TRANSITIONS[currentStatus].includes(transition.newStatus) || transition.previousStatus !== currentStatus) {
      throw new Error(`Transición de evento inválida en ${event.code}: ${currentStatus} -> ${transition.newStatus}`);
    }
    await tx.event.update({ where: { id: event.id }, data: { status: transition.newStatus, updatedAt: transition.at } });
    await writeAudit(tx, bundle, `event.${transition.newStatus.toLowerCase()}`, "event", event.id, transition.at, transitionIndex);
    currentStatus = transition.newStatus;
  }
  if (currentStatus !== event.status) {
    throw new Error(`El evento ${event.code} terminó en ${currentStatus} y debía terminar en ${event.status}.`);
  }
}

async function writeAudit(tx, bundle, action, targetType, targetId, createdAt, sequence = 0) {
  return tx.organizationAuditLog.create({
    data: {
      id: deterministicUuid(`audit:${bundle.organization.id}:${action}:${targetId}:${sequence}`),
      organizationId: bundle.organization.id,
      actorUserId: bundle.user.id,
      action,
      targetType,
      targetId,
      metadata: { demoDataset: DATASET_VERSION },
      createdAt
    }
  });
}

async function removeManagedDemoOrganizations(tx) {
  const markers = managedDemoMarkers();
  const candidates = await tx.organization.findMany({
    where: { OR: markers.flatMap((marker) => [{ id: marker.id }, { slug: marker.slug }]) },
    include: { createdBy: { select: { email: true } } }
  });
  for (const candidate of candidates) {
    if (!isManagedDemoOrganization(candidate)) {
      throw new Error(`Operación demo cancelada: la organización ${candidate.slug} no coincide con su identidad administrada.`);
    }
  }
  if (candidates.length > 0) {
    await tx.organization.deleteMany({ where: { id: { in: candidates.map((candidate) => candidate.id) } } });
  }
  return candidates.length;
}

async function countUserDomainReferences(tx, userId) {
  const counts = await Promise.all([
    tx.organization.count({ where: { createdByUserId: userId } }),
    tx.organizationMembership.count({ where: { userId } }),
    tx.organizationInvitation.count({ where: { invitedByUserId: userId } }),
    tx.organizationAuditLog.count({ where: { actorUserId: userId } }),
    tx.client.count({ where: { createdByUserId: userId } }),
    tx.clientInteraction.count({ where: { userId } }),
    tx.catalogItem.count({ where: { createdByUserId: userId } }),
    tx.quotation.count({ where: { createdByUserId: userId } }),
    tx.quotationStatusHistory.count({ where: { changedByUserId: userId } }),
    tx.event.count({ where: { createdByUserId: userId } }),
    tx.eventTask.count({ where: { OR: [{ createdByUserId: userId }, { assignedUserId: userId }] } }),
    tx.eventParticipant.count({ where: { userId } })
  ]);
  return counts.reduce((total, count) => total + count, 0);
}

function verifyTopLevelCounts(issues, expectedCounts, actual) {
  expectCount(issues, "counts", "usuarios", actual.users.length, expectedCounts.users);
  expectCount(issues, "counts", "organizaciones", actual.organizations.length, expectedCounts.organizations);
  expectCount(issues, "counts", "clientes", actual.clients.length, expectedCounts.clients);
  expectCount(issues, "counts", "interacciones", actual.interactions.length, expectedCounts.interactions);
  expectCount(issues, "counts", "catálogo", actual.catalogItems.length, expectedCounts.catalogItems);
  expectCount(issues, "counts", "cotizaciones", actual.quotations.length, expectedCounts.quotations);
  expectCount(issues, "counts", "eventos", actual.events.length, expectedCounts.events);
}

async function verifyUsersAndOrganizations(issues, expected, users, organizations, markedOrganizations) {
  const userById = new Map(users.map((user) => [user.id, user]));
  const organizationById = new Map(organizations.map((organization) => [organization.id, organization]));
  for (const bundle of expected.bundles) {
    const user = userById.get(bundle.user.id);
    const organization = organizationById.get(bundle.organization.id);
    if (!user) {
      issues.add("relationships", `Falta el usuario ${bundle.user.email}.`, true);
      continue;
    }
    if (user.email !== bundle.user.email || user.firstName !== bundle.user.firstName || user.lastName !== bundle.user.lastName || user.locale !== "es" || user.status !== "ACTIVE") {
      issues.add("relationships", `Perfil demo incoherente para ${bundle.user.email}.`);
    }
    if (user.passwordHash === DEMO_PASSWORD || !user.passwordHash.startsWith("$argon2id$") || !(await verifiesPassword(user.passwordHash))) {
      issues.add("passwords", `Password hash inválido para ${bundle.user.email}.`);
    }
    const expectedMembership = user.organizationMemberships.filter((membership) => membership.organizationId === bundle.organization.id);
    if (user.organizationMemberships.length !== 1 || expectedMembership.length !== 1 || expectedMembership[0].role !== "OWNER" || expectedMembership[0].status !== "ACTIVE") {
      issues.add("isolation", `${bundle.user.email} no tiene una única membresía OWNER aislada.`);
    }
    if (user.createdOrganizations.length !== 1 || user.createdOrganizations[0].id !== bundle.organization.id) {
      issues.add("isolation", `${bundle.user.email} crea o referencia una organización inesperada.`);
    }
    if (!organization) {
      issues.add("relationships", `Falta la organización ${bundle.organization.slug}.`, true);
      continue;
    }
    if (
      organization.name !== bundle.organization.name ||
      organization.legalName !== bundle.organization.legalName ||
      organization.createdByUserId !== user.id ||
      organization.country !== "CL" ||
      organization.currency !== "CLP" ||
      organization.timezone !== "America/Santiago"
    ) {
      issues.add("relationships", `Configuración incoherente en ${bundle.organization.slug}.`);
    }
    verifyRut(issues, organization.taxId, `organización ${bundle.organization.slug}`);
  }
  const expectedMarkerIds = new Set(expected.bundles.map((bundle) => bundle.organization.id));
  const unexpected = markedOrganizations.filter((organization) => !expectedMarkerIds.has(organization.id));
  if (unexpected.length > 0) {
    issues.add("isolation", `Persisten organizaciones demo legadas: ${unexpected.map((item) => item.slug).join(", ")}.`);
  }
}

function verifyClientsAndInteractions(issues, expected, clients, interactions, quotations, events) {
  const clientById = new Map(clients.map((client) => [client.id, client]));
  const taxIds = new Set();
  for (const bundle of expected.bundles) {
    const tenantClients = clients.filter((client) => client.organizationId === bundle.organization.id);
    expectCount(issues, "counts", `clientes de ${bundle.organization.slug}`, tenantClients.length, 10);
    expectCount(issues, "states", `personas naturales de ${bundle.organization.slug}`, tenantClients.filter((client) => client.type === "NATURAL_PERSON").length, 5);
    expectCount(issues, "states", `empresas de ${bundle.organization.slug}`, tenantClients.filter((client) => client.type === "LEGAL_ENTITY").length, 5);
    for (const expectedClient of bundle.clients) {
      const client = clientById.get(expectedClient.id);
      if (!client) {
        issues.add("relationships", `Falta cliente ${expectedClient.displayName}.`, true);
        continue;
      }
      if (client.organizationId !== bundle.organization.id || client.createdByUserId !== bundle.user.id || client.type !== expectedClient.type) {
        issues.add("isolation", `Cliente ${client.id} cruza organización o creador.`);
      }
      verifyRut(issues, client.taxId, `cliente ${expectedClient.displayName}`);
      if (taxIds.has(client.taxId)) issues.add("ruts", `RUT duplicado globalmente: ${client.taxId}.`);
      taxIds.add(client.taxId);
      const clientInteractions = interactions.filter((interaction) => interaction.clientId === client.id);
      if (clientInteractions.length < 1 || clientInteractions.length > 3) {
        issues.add("states", `Cliente ${client.displayName} debe tener entre 1 y 3 interacciones.`);
      }
      const firstRelatedDate = [
        ...quotations.filter((quotation) => quotation.clientId === client.id).map((quotation) => quotation.issueDate),
        ...events.filter((event) => event.clientId === client.id).map((event) => event.startAt)
      ].sort((left, right) => left.getTime() - right.getTime())[0];
      for (const interaction of clientInteractions) {
        if (interaction.organizationId !== client.organizationId || interaction.client.organizationId !== client.organizationId || interaction.userId !== bundle.user.id) {
          issues.add("isolation", `Interacción ${interaction.id} cruza organización, cliente o usuario.`, true);
        }
        if (firstRelatedDate && interaction.occurredAt.getTime() > firstRelatedDate.getTime()) {
          issues.add("states", `Interacción ${interaction.id} ocurre después de su primer documento o evento relacionado.`);
        }
      }
    }
  }
}

function verifyCatalog(issues, expected, catalogItems) {
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  for (const bundle of expected.bundles) {
    const tenantCatalog = catalogItems.filter((item) => item.organizationId === bundle.organization.id);
    expectCount(issues, "counts", `catálogo de ${bundle.organization.slug}`, tenantCatalog.length, 12);
    expectCount(issues, "states", `productos de ${bundle.organization.slug}`, tenantCatalog.filter((item) => item.type === "PRODUCT").length, 6);
    expectCount(issues, "states", `servicios de ${bundle.organization.slug}`, tenantCatalog.filter((item) => item.type === "SERVICE").length, 6);
    for (const expectedItem of bundle.catalogItems) {
      const item = catalogById.get(expectedItem.id);
      if (!item) {
        issues.add("relationships", `Falta ítem de catálogo ${expectedItem.code}.`, true);
        continue;
      }
      if (item.organizationId !== bundle.organization.id || item.createdByUserId !== bundle.user.id || !item.code.startsWith("DEMO-")) {
        issues.add("isolation", `Ítem ${item.id} no pertenece íntegramente a ${bundle.organization.slug}.`);
      }
      if ((item.type === "PRODUCT") !== item.trackInventory || (item.type === "PRODUCT" && !item.sku) || (item.type === "SERVICE" && item.sku !== null)) {
        issues.add("states", `Inventario o SKU incoherente en ${item.code}.`);
      }
      if (item.cost.isNegative() || item.price.isNegative() || item.currency !== "CLP") {
        issues.add("states", `Valores monetarios incoherentes en ${item.code}.`);
      }
    }
  }
}

function verifyQuotations(issues, expected, quotations, catalogItems) {
  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  for (const bundle of expected.bundles) {
    const tenantQuotations = quotations.filter((quotation) => quotation.organizationId === bundle.organization.id);
    expectCount(issues, "counts", `cotizaciones de ${bundle.organization.slug}`, tenantQuotations.length, 8);
    const expectedStatuses = { DRAFT: 2, SENT: 2, APPROVED: 2, REJECTED: 1, CANCELLED: 1 };
    for (const [status, count] of Object.entries(expectedStatuses)) {
      expectCount(issues, "states", `${status} de ${bundle.organization.slug}`, tenantQuotations.filter((quotation) => quotation.status === status).length, count);
    }
    if (!tenantQuotations.some((quotation) => quotation.version > 1 && tenantQuotations.some((candidate) => candidate.number === quotation.number && candidate.version === quotation.version - 1))) {
      issues.add("states", `${bundle.organization.slug} no tiene una nueva versión de cotización coherente.`);
    }
    for (const quotation of tenantQuotations) {
      if (quotation.client.organizationId !== quotation.organizationId || quotation.createdByUserId !== bundle.user.id) {
        issues.add("isolation", `Cotización ${quotation.number} cruza cliente o creador.`, true);
      }
      if (quotation.items.length < 2 || quotation.items.length > 6) {
        issues.add("states", `Cotización ${quotation.number} debe tener entre 2 y 6 ítems.`);
      }
      if (quotation.issueDate.getTime() > quotation.validUntil.getTime()) {
        issues.add("states", `Fechas inválidas en ${quotation.number}.`);
      }
      for (const item of quotation.items) {
        const catalogItem = item.catalogItemId ? catalogById.get(item.catalogItemId) : null;
        if (!catalogItem || catalogItem.organizationId !== quotation.organizationId) {
          issues.add("isolation", `Ítem ${item.id} de ${quotation.number} referencia catálogo externo.`, true);
          continue;
        }
        if (
          item.code !== catalogItem.code ||
          item.name !== catalogItem.name ||
          item.type !== catalogItem.type ||
          item.unit !== catalogItem.unit ||
          !item.unitPrice.equals(catalogItem.price) ||
          !item.taxPercent.equals(catalogItem.taxPercent)
        ) {
          issues.add("relationships", `Snapshot de catálogo incoherente en ${quotation.number}.`);
        }
        verifyQuotationItemTotals(issues, quotation, item);
      }
      const subtotal = sum(quotation.items.map((item) => item.subtotal));
      const discountTotal = sum(quotation.items.map((item) => item.discountTotal));
      const taxTotal = sum(quotation.items.map((item) => item.taxTotal));
      const total = sum(quotation.items.map((item) => item.total));
      if (!subtotal.equals(quotation.subtotal) || !discountTotal.equals(quotation.discountTotal) || !taxTotal.equals(quotation.taxTotal) || !total.equals(quotation.total)) {
        issues.add("totals", `Totales agregados incoherentes en ${quotation.number} v${quotation.version}.`);
      }
      verifyQuotationHistory(issues, quotation, bundle.user.id);
    }
  }
}

function verifyQuotationItemTotals(issues, quotation, item) {
  const subtotal = money(item.quantity.mul(item.unitPrice));
  const discountTotal =
    item.discountType === "PERCENTAGE"
      ? money(subtotal.mul(item.discountValue).div(100))
      : item.discountType === "FIXED"
        ? Prisma.Decimal.min(item.discountValue, subtotal)
        : money("0");
  const taxTotal = money(subtotal.sub(discountTotal).mul(item.taxPercent).div(100));
  const total = money(subtotal.sub(discountTotal).add(taxTotal));
  if (!subtotal.equals(item.subtotal) || !discountTotal.equals(item.discountTotal) || !taxTotal.equals(item.taxTotal) || !total.equals(item.total)) {
    issues.add("totals", `Ítem ${item.id} tiene totales incoherentes en ${quotation.number}.`);
  }
}

function verifyQuotationHistory(issues, quotation, ownerUserId) {
  if (quotation.history.length === 0 || quotation.history[0].previousStatus !== null || quotation.history[0].newStatus !== "DRAFT") {
    issues.add("states", `Historial inicial inválido en ${quotation.number}.`);
    return;
  }
  let currentStatus = "DRAFT";
  for (const history of quotation.history.slice(1)) {
    if (history.organizationId !== quotation.organizationId || history.changedByUserId !== ownerUserId) {
      issues.add("isolation", `Historial ${history.id} cruza organización o usuario.`, true);
    }
    if (history.previousStatus !== currentStatus || !QUOTATION_TRANSITIONS[currentStatus].includes(history.newStatus)) {
      issues.add("states", `Transición inválida ${currentStatus} -> ${history.newStatus} en ${quotation.number}.`);
    }
    currentStatus = history.newStatus;
  }
  if (currentStatus !== quotation.status) {
    issues.add("states", `Historial y estado final no coinciden en ${quotation.number}.`);
  }
}

function verifyEvents(issues, expected, events) {
  for (const bundle of expected.bundles) {
    const tenantEvents = events.filter((event) => event.organizationId === bundle.organization.id);
    expectCount(issues, "counts", `eventos de ${bundle.organization.slug}`, tenantEvents.length, 5);
    for (const status of ["DRAFT", "CONFIRMED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]) {
      expectCount(issues, "states", `${status} de ${bundle.organization.slug}`, tenantEvents.filter((event) => event.status === status).length, 1);
    }
    const linkedEvents = tenantEvents.filter((event) => event.quotationId !== null);
    expectCount(issues, "relationships", `eventos desde cotización de ${bundle.organization.slug}`, linkedEvents.length, 2);
    if (new Set(linkedEvents.map((event) => event.quotationId)).size !== linkedEvents.length) {
      issues.add("relationships", `${bundle.organization.slug} reutiliza una cotización en más de un evento.`);
    }
    for (const event of tenantEvents) {
      if (!event.client || event.client.organizationId !== event.organizationId || event.createdByUserId !== bundle.user.id) {
        issues.add("isolation", `Evento ${event.code} cruza cliente o creador.`, true);
      }
      if (event.startAt.getTime() >= event.endAt.getTime() || event.timezone !== "America/Santiago" || event.currency !== "CLP") {
        issues.add("states", `Fechas o configuración inválidas en ${event.code}.`);
      }
      if (event.tasks.length < 3 || event.tasks.length > 8 || event.participants.length < 2 || event.participants.length > 6 || event.resources.length < 2 || event.resources.length > 5 || event.timeline.length < 3 || event.timeline.length > 6) {
        issues.add("states", `Profundidad operativa fuera de rango en ${event.code}.`);
      }
      if (event.status === "COMPLETED" && event.tasks.filter((task) => task.status === "COMPLETED").length <= event.tasks.length / 2) {
        issues.add("states", `Evento completado ${event.code} no tiene mayoría de tareas completadas.`);
      }
      if (["DRAFT", "CONFIRMED"].includes(event.status) && event.tasks.some((task) => task.status !== "PENDING")) {
        issues.add("states", `Evento futuro ${event.code} contiene tareas no pendientes.`);
      }
      if (event.status === "CANCELLED" && event.tasks.some((task) => !["CANCELLED", "COMPLETED"].includes(task.status))) {
        issues.add("states", `Evento cancelado ${event.code} conserva tareas abiertas.`);
      }
      if (event.quotation) {
        if (event.quotation.organizationId !== event.organizationId || event.quotation.status !== "APPROVED" || event.quotation.clientId !== event.clientId) {
          issues.add("isolation", `Evento ${event.code} referencia una cotización inválida.`, true);
        }
        const quotationCatalogIds = new Set(event.quotation.items.map((item) => item.catalogItemId));
        if (event.resources.length !== event.quotation.items.length || event.resources.some((resource) => !quotationCatalogIds.has(resource.catalogItemId))) {
          issues.add("relationships", `Recursos de ${event.code} no reflejan su cotización aprobada.`);
        }
      }
      for (const task of event.tasks) {
        if (task.organizationId !== event.organizationId || task.createdByUserId !== bundle.user.id || task.assignedUserId !== bundle.user.id) {
          issues.add("isolation", `Tarea ${task.id} cruza organización o usuario.`, true);
        }
      }
      for (const participant of event.participants) {
        const userIsOwner = participant.userId === null || participant.userId === bundle.user.id;
        const clientIsTenant = participant.clientId === null || participant.client?.organizationId === event.organizationId;
        if (participant.organizationId !== event.organizationId || !userIsOwner || !clientIsTenant) {
          issues.add("isolation", `Participante ${participant.id} cruza organización.`, true);
        }
      }
      for (const resource of event.resources) {
        if (resource.organizationId !== event.organizationId || resource.catalogItem?.organizationId !== event.organizationId) {
          issues.add("isolation", `Recurso ${resource.id} cruza catálogo u organización.`, true);
        }
      }
      for (const entry of event.timeline) {
        if (entry.organizationId !== event.organizationId || entry.eventId !== event.id) {
          issues.add("isolation", `Hito ${entry.id} está huérfano o cruza organización.`, true);
        }
      }
    }
  }
}

function verifyAuditLogs(issues, expected, auditLogs) {
  const ownerByOrganization = new Map(expected.bundles.map((bundle) => [bundle.organization.id, bundle.user.id]));
  for (const log of auditLogs) {
    if (ownerByOrganization.get(log.organizationId) !== log.actorUserId) {
      issues.add("isolation", `Audit log ${log.id} cruza actor u organización.`, true);
    }
    const metadata = log.metadata;
    if (!metadata || typeof metadata !== "object" || metadata.demoDataset !== DATASET_VERSION) {
      issues.add("relationships", `Audit log ${log.id} no conserva el marcador demo.`);
    }
  }
}

function indexExpectedDataset(dataset) {
  return { bundles: dataset.organizations };
}

function createIssueCollector() {
  const groups = {
    counts: [],
    ruts: [],
    passwords: [],
    totals: [],
    relationships: [],
    isolation: [],
    states: []
  };
  return {
    groups,
    orphanCount: 0,
    add(group, message, orphan = false) {
      groups[group].push(message);
      if (orphan) this.orphanCount += 1;
    }
  };
}

function verifyRut(issues, value, label) {
  if (!value || !isValidChileanRut(value) || normalizeChileanRut(value) !== value) {
    issues.add("ruts", `RUT inválido o no normalizado para ${label}: ${value ?? "sin RUT"}.`);
  }
}

function expectCount(issues, group, label, actual, expected) {
  if (actual !== expected) issues.add(group, `${label}: se esperaban ${expected}, se encontraron ${actual}.`);
}

function quotationTransitionPlan(finalStatus, issueDate) {
  const path = {
    DRAFT: [],
    SENT: ["SENT"],
    APPROVED: ["SENT", "APPROVED"],
    REJECTED: ["SENT", "REJECTED"],
    CANCELLED: ["CANCELLED"]
  }[finalStatus];
  if (!path) throw new Error(`Estado final de cotización no soportado por el seed: ${finalStatus}`);
  let previousStatus = "DRAFT";
  return path.map((newStatus, index) => {
    const transition = { previousStatus, newStatus, at: addDays(issueDate, index + 1) };
    previousStatus = newStatus;
    return transition;
  });
}

function eventTransitionPlan(finalStatus, createdAt, startAt, endAt) {
  const plans = {
    DRAFT: [],
    CONFIRMED: [{ previousStatus: "DRAFT", newStatus: "CONFIRMED", at: addDays(createdAt, 3) }],
    IN_PROGRESS: [
      { previousStatus: "DRAFT", newStatus: "CONFIRMED", at: addDays(createdAt, 2) },
      { previousStatus: "CONFIRMED", newStatus: "IN_PROGRESS", at: startAt }
    ],
    COMPLETED: [
      { previousStatus: "DRAFT", newStatus: "CONFIRMED", at: addDays(createdAt, 2) },
      { previousStatus: "CONFIRMED", newStatus: "IN_PROGRESS", at: startAt },
      { previousStatus: "IN_PROGRESS", newStatus: "COMPLETED", at: endAt }
    ],
    CANCELLED: [{ previousStatus: "DRAFT", newStatus: "CANCELLED", at: addDays(createdAt, 4) }]
  };
  const result = plans[finalStatus];
  if (!result) throw new Error(`Estado final de evento no soportado por el seed: ${finalStatus}`);
  return result;
}

function quantityFor(catalogItem, planIndex, itemIndex) {
  if (catalogItem.unit === "persona") return new Prisma.Decimal(12 + planIndex + itemIndex * 3);
  if (catalogItem.unit === "hora") return new Prisma.Decimal(3 + ((planIndex + itemIndex) % 5));
  if (["jornada", "sesión", "proyecto", "viaje"].includes(catalogItem.unit)) return new Prisma.Decimal(1);
  return new Prisma.Decimal(1 + ((planIndex + itemIndex) % 4));
}

function datasetCounts(organizations) {
  return {
    users: organizations.length,
    organizations: organizations.length,
    clients: organizations.reduce((total, bundle) => total + bundle.clients.length, 0),
    interactions: organizations.reduce((total, bundle) => total + bundle.clients.reduce((sumInteractions, client) => sumInteractions + client.interactions.length, 0), 0),
    catalogItems: organizations.reduce((total, bundle) => total + bundle.catalogItems.length, 0),
    quotations: organizations.reduce((total, bundle) => total + bundle.quotations.length, 0),
    quotationItems: organizations.reduce((total, bundle) => total + bundle.quotations.reduce((sumItems, quotation) => sumItems + quotation.items.length, 0), 0),
    events: organizations.reduce((total, bundle) => total + bundle.events.length, 0),
    eventTasks: organizations.reduce((total, bundle) => total + bundle.events.reduce((sumItems, event) => sumItems + event.tasks.length, 0), 0),
    eventParticipants: organizations.reduce((total, bundle) => total + bundle.events.reduce((sumItems, event) => sumItems + event.participants.length, 0), 0),
    eventResources: organizations.reduce((total, bundle) => total + bundle.events.reduce((sumItems, event) => sumItems + event.resources.length, 0), 0),
    eventTimelineEntries: organizations.reduce((total, bundle) => total + bundle.events.reduce((sumItems, event) => sumItems + event.timeline.length, 0), 0)
  };
}

function without(value, keys) {
  const result = { ...value };
  for (const key of keys) delete result[key];
  return result;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function addHours(date, hours) {
  return new Date(date.getTime() + hours * HOUR_MS);
}

function money(value) {
  return new Prisma.Decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

function sum(values) {
  return values.reduce((total, value) => total.add(value), new Prisma.Decimal(0)).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

async function verifiesPassword(passwordHash) {
  try {
    return await argon2.verify(passwordHash, DEMO_PASSWORD);
  } catch {
    return false;
  }
}
