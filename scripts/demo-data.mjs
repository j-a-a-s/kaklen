import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { Prisma, PrismaClient } from "@prisma/client";

const requireApi = createRequire(new URL("../apps/api/package.json", import.meta.url));
const argon2 = requireApi("argon2");

export const DEMO_PASSWORD = "KaklenDemo2026!";
export const DEMO_ORGANIZATIONS = [
  {
    email: "empresa.angela@demo.kaklen.local",
    firstName: "Ángela",
    lastName: "Pérez",
    name: "Ángela Producciones",
    legalName: "Ángela Producciones SpA",
    slug: "demo-angela-producciones",
    rutBase: 76111001
  },
  {
    email: "empresa.koke@demo.kaklen.local",
    firstName: "Jorge",
    lastName: "Arancibia",
    name: "Koke Eventos",
    legalName: "Koke Eventos SpA",
    slug: "demo-koke-eventos",
    rutBase: 76111002
  },
  {
    email: "carolina.mendez@demo.kaklen.local",
    firstName: "Carolina",
    lastName: "Méndez",
    name: "Méndez Experiencias",
    legalName: "Méndez Experiencias Ltda.",
    slug: "demo-mendez-experiencias",
    rutBase: 76111003
  },
  {
    email: "tomas.rivera@demo.kaklen.local",
    firstName: "Tomás",
    lastName: "Rivera",
    name: "Rivera Operaciones",
    legalName: "Rivera Operaciones SpA",
    slug: "demo-rivera-operaciones",
    rutBase: 76111004
  }
];

const clientNames = [
  "Comercial Andes SpA",
  "Fundación Horizonte",
  "Camila Soto",
  "Diego Morales",
  "Mercado Central Ltda.",
  "Paula Contreras",
  "Constructora Pacífico SpA",
  "Martín Silva",
  "Turismo Cordillera Ltda.",
  "Fernanda Rojas"
];

const catalog = [
  ["PRODUCT", "SILLA", "Silla plegable premium", "unidad", 18000, 32500],
  ["PRODUCT", "MESA", "Mesa rectangular para evento", "unidad", 45000, 79000],
  ["PRODUCT", "ILUMINACION", "Kit de iluminación ambiental", "kit", 85000, 145000],
  ["PRODUCT", "SONIDO", "Sistema de sonido profesional", "kit", 190000, 310000],
  ["PRODUCT", "PANTALLA", "Pantalla LED modular", "m2", 110000, 185000],
  ["PRODUCT", "DECORACION", "Set de decoración corporativa", "set", 65000, 115000],
  ["SERVICE", "COORDINACION", "Coordinación general", "hora", 28000, 48000],
  ["SERVICE", "MONTAJE", "Equipo de montaje", "hora", 22000, 39000],
  ["SERVICE", "FOTOGRAFIA", "Cobertura fotográfica", "jornada", 190000, 320000],
  ["SERVICE", "CATERING", "Servicio de catering", "persona", 14500, 23900],
  ["SERVICE", "ANIMACION", "Animación de evento", "hora", 45000, 75000],
  ["SERVICE", "TRANSPORTE", "Transporte y logística", "viaje", 85000, 135000]
];

const quotationStatuses = ["DRAFT", "SENT", "APPROVED", "REJECTED", "CANCELLED", "APPROVED", "SENT", "EXPIRED"];
const eventStatuses = ["COMPLETED", "CONFIRMED", "IN_PROGRESS", "DRAFT", "CANCELLED"];
const DEMO_CREATED_AT = new Date("2026-01-05T12:00:00.000Z");

export function deterministicUuid(key) {
  const hash = createHash("sha256").update(`kaklen-demo:${key}`).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20)}`;
}

export function formatRut(base) {
  const raw = String(base);
  let factor = 2;
  let total = 0;
  for (let index = raw.length - 1; index >= 0; index -= 1) {
    total += Number(raw[index]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const remainder = 11 - (total % 11);
  const verifier = remainder === 11 ? "0" : remainder === 10 ? "K" : String(remainder);
  return `${Number(raw).toLocaleString("es-CL")}-${verifier}`;
}

export function isValidRut(value) {
  const normalized = value.replace(/[^0-9kK]/g, "").toUpperCase();
  if (normalized.length < 2) return false;
  return formatRut(Number(normalized.slice(0, -1))).replace(/[^0-9kK]/g, "").toUpperCase() === normalized;
}

export async function clearDemoData(prisma) {
  const slugs = DEMO_ORGANIZATIONS.map((organization) => organization.slug);
  const emails = DEMO_ORGANIZATIONS.map((organization) => organization.email);
  const organizations = await prisma.organization.findMany({ where: { slug: { in: slugs } }, select: { id: true } });
  if (organizations.length > 0) {
    await prisma.organization.deleteMany({ where: { id: { in: organizations.map((organization) => organization.id) } } });
  }
  await prisma.user.deleteMany({
    where: {
      email: { in: emails },
      createdOrganizations: { none: {} },
      organizationMemberships: { none: {} }
    }
  });
  return organizations.length;
}

export async function seedDemoData(prisma) {
  await clearDemoData(prisma);
  const passwordHash = await argon2.hash(DEMO_PASSWORD, { type: argon2.argon2id });

  for (const [organizationIndex, definition] of DEMO_ORGANIZATIONS.entries()) {
    const userId = deterministicUuid(`user:${definition.email}`);
    const organizationId = deterministicUuid(`organization:${definition.slug}`);
    const user = await prisma.user.create({
      data: {
        id: userId,
        email: definition.email,
        firstName: definition.firstName,
        lastName: definition.lastName,
        passwordHash,
        locale: organizationIndex === 2 ? "en" : organizationIndex === 3 ? "pt-BR" : "es",
        createdAt: DEMO_CREATED_AT,
        updatedAt: DEMO_CREATED_AT
      }
    });
    await prisma.organization.create({
      data: {
        id: organizationId,
        name: definition.name,
        slug: definition.slug,
        legalName: definition.legalName,
        taxId: formatRut(definition.rutBase),
        country: "CL",
        currency: "CLP",
        timezone: "America/Santiago",
        dateFormat: "dd-MM-yyyy",
        numberFormat: "es",
        defaultLocale: "es",
        createdByUserId: user.id,
        createdAt: DEMO_CREATED_AT,
        updatedAt: DEMO_CREATED_AT,
        memberships: { create: { id: deterministicUuid(`membership:${organizationId}`), userId: user.id, role: "OWNER", createdAt: DEMO_CREATED_AT, updatedAt: DEMO_CREATED_AT } }
      }
    });

    const clients = [];
    for (let index = 0; index < clientNames.length; index += 1) {
      const isCompany = index % 2 === 0;
      const displayName = `${clientNames[index]}${organizationIndex > 0 && isCompany ? ` ${organizationIndex + 1}` : ""}`;
      const names = displayName.split(" ");
      const clientCreatedAt = new Date(`2026-0${(index % 6) + 1}-${String((index % 20) + 1).padStart(2, "0")}T12:00:00.000Z`);
      const client = await prisma.client.create({
        data: {
          id: deterministicUuid(`client:${organizationId}:${index}`),
          organizationId,
          type: isCompany ? "LEGAL_ENTITY" : "NATURAL_PERSON",
          status: index === 9 ? "LEAD" : "ACTIVE",
          displayName,
          firstName: isCompany ? null : names[0],
          lastName: isCompany ? null : names.slice(1).join(" "),
          legalName: isCompany ? displayName : null,
          taxId: isCompany ? formatRut(77000000 + organizationIndex * 100 + index) : index === 3 ? formatRut(18000000 + organizationIndex * 100 + index) : null,
          email: `contacto.${organizationIndex + 1}.${index + 1}@demo.kaklen.local`,
          phone: `+56 9 ${String(3100 + organizationIndex * 100 + index).padStart(4, "0")} ${String(5500 + index).padStart(4, "0")}`,
          whatsapp: index % 3 === 0 ? `+56 9 ${String(4100 + organizationIndex * 100 + index).padStart(4, "0")} ${String(6600 + index).padStart(4, "0")}` : null,
          country: "CL",
          region: "Metropolitana de Santiago",
          city: index % 2 === 0 ? "Santiago" : "Providencia",
          address: `Avenida Demo ${100 + index}`,
          notes: index === 0 ? "Cliente prioritario para seguimiento comercial." : null,
          createdByUserId: user.id,
          createdAt: clientCreatedAt,
          updatedAt: clientCreatedAt
        }
      });
      clients.push(client);
      await prisma.clientInteraction.createMany({
        data: [0, 1].map((interactionIndex) => {
          const occurredAt = new Date(`2026-07-${String(Math.max(1, 12 - index - interactionIndex)).padStart(2, "0")}T15:00:00.000Z`);
          return {
          id: deterministicUuid(`interaction:${client.id}:${interactionIndex}`),
          organizationId,
          clientId: client.id,
          userId: user.id,
          type: interactionIndex === 0 ? "CALL" : "EMAIL",
          subject: interactionIndex === 0 ? "Seguimiento comercial" : "Envío de antecedentes",
          description: interactionIndex === 0 ? "Se revisaron necesidades y próximos pasos." : "Se enviaron detalles y condiciones del servicio.",
          occurredAt,
          createdAt: occurredAt
          };
        })
      });
    }

    const catalogItems = [];
    for (const [index, item] of catalog.entries()) {
      const [type, code, name, unit, cost, price] = item;
      const catalogCreatedAt = new Date(`2026-01-${String(index + 10).padStart(2, "0")}T12:00:00.000Z`);
      const catalogItem = await prisma.catalogItem.create({
        data: {
          id: deterministicUuid(`catalog:${organizationId}:${index}`),
          organizationId,
          type,
          status: "ACTIVE",
          sku: type === "PRODUCT" ? `DEMO-${organizationIndex + 1}-${String(index + 1).padStart(3, "0")}` : null,
          code: `${code}-${organizationIndex + 1}`,
          name,
          description: `Opción demo de ${name.toLowerCase()}.`,
          unit,
          cost: new Prisma.Decimal(cost),
          price: new Prisma.Decimal(price),
          taxPercent: new Prisma.Decimal(19),
          currency: "CLP",
          trackInventory: type === "PRODUCT",
          createdByUserId: user.id,
          createdAt: catalogCreatedAt,
          updatedAt: catalogCreatedAt
        }
      });
      catalogItems.push(catalogItem);
    }

    const quotations = [];
    for (let index = 0; index < quotationStatuses.length; index += 1) {
      const catalogItem = catalogItems[index % catalogItems.length];
      const quantity = new Prisma.Decimal((index % 3) + 1);
      const unitPrice = catalogItem.price;
      const subtotal = unitPrice.mul(quantity);
      const discountTotal = index === 4 ? subtotal.mul(new Prisma.Decimal("0.10")) : new Prisma.Decimal(0);
      const taxable = subtotal.sub(discountTotal);
      const taxTotal = taxable.mul(new Prisma.Decimal("0.19")).toDecimalPlaces(2);
      const total = taxable.add(taxTotal);
      const status = quotationStatuses[index];
      const issueDate = new Date(`2026-07-${String(index + 1).padStart(2, "0")}T12:00:00.000Z`);
      const validUntil = new Date(`2026-07-${String(index + 18).padStart(2, "0")}T23:59:59.000Z`);
      const sentAt = ["SENT", "APPROVED", "REJECTED"].includes(status) ? new Date(issueDate.getTime() + 86400000) : null;
      const approvedAt = status === "APPROVED" ? new Date(issueDate.getTime() + 2 * 86400000) : null;
      const rejectedAt = status === "REJECTED" ? new Date(issueDate.getTime() + 2 * 86400000) : null;
      const quotationUpdatedAt = approvedAt ?? rejectedAt ?? sentAt ?? issueDate;
      const quotation = await prisma.quotation.create({
        data: {
          id: deterministicUuid(`quotation:${organizationId}:${index}`),
          organizationId,
          clientId: clients[index].id,
          number: `Q-${organizationIndex + 1}${String(index + 1).padStart(3, "0")}`,
          version: 1,
          status,
          issueDate,
          validUntil,
          currency: "CLP",
          subtotal,
          discountTotal,
          taxTotal,
          total,
          notes: "Propuesta preparada con datos demostrativos.",
          terms: "Vigencia y coordinación sujetas a confirmación.",
          createdByUserId: user.id,
          sentAt,
          approvedAt,
          rejectedAt,
          createdAt: issueDate,
          updatedAt: quotationUpdatedAt,
          items: {
            create: {
              id: deterministicUuid(`quotation-item:${organizationId}:${index}`),
              catalogItemId: catalogItem.id,
              type: catalogItem.type,
              code: catalogItem.code,
              name: catalogItem.name,
              description: catalogItem.description,
              quantity,
              unit: catalogItem.unit,
              unitPrice,
              discountType: index === 4 ? "PERCENTAGE" : "NONE",
              discountValue: new Prisma.Decimal(index === 4 ? 10 : 0),
              taxPercent: new Prisma.Decimal(19),
              subtotal,
              discountTotal,
              taxTotal,
              total,
              sortOrder: 1
            }
          },
          history: {
            create: {
              id: deterministicUuid(`quotation-history:${organizationId}:${index}`),
              organizationId,
              previousStatus: null,
              newStatus: status,
              changedByUserId: user.id,
              note: "Dataset demo",
              createdAt: quotationUpdatedAt
            }
          }
        }
      });
      quotations.push(quotation);
    }

    const events = [];
    const eventDates = [
      ["2026-06-12T13:00:00.000Z", "2026-06-12T21:00:00.000Z"],
      ["2026-07-16T13:00:00.000Z", "2026-07-16T21:00:00.000Z"],
      ["2026-07-15T14:00:00.000Z", "2026-07-15T20:00:00.000Z"],
      ["2026-08-03T13:00:00.000Z", "2026-08-03T21:00:00.000Z"],
      ["2026-05-18T13:00:00.000Z", "2026-05-18T21:00:00.000Z"]
    ];
    for (let index = 0; index < eventStatuses.length; index += 1) {
      const linkedQuotation = index < 2 ? quotations[index === 0 ? 2 : 5] : null;
      const startAt = new Date(eventDates[index][0]);
      const endAt = new Date(eventDates[index][1]);
      const eventCreatedAt = new Date(startAt.getTime() - 30 * 86400000);
      const eventUpdatedAt = eventStatuses[index] === "COMPLETED" ? endAt : new Date(startAt.getTime() - 86400000);
      const event = await prisma.event.create({
        data: {
          id: deterministicUuid(`event:${organizationId}:${index}`),
          organizationId,
          clientId: linkedQuotation?.clientId ?? clients[(index + 2) % clients.length].id,
          quotationId: linkedQuotation?.id ?? null,
          code: `EV-${organizationIndex + 1}${String(index + 1).padStart(3, "0")}`,
          name: ["Lanzamiento de temporada", "Encuentro corporativo", "Montaje feria local", "Celebración de aniversario", "Activación de marca"][index],
          description: "Evento demostrativo con planificación operativa completa.",
          status: eventStatuses[index],
          startAt,
          endAt,
          timezone: "America/Santiago",
          venueName: index % 2 === 0 ? "Centro de Eventos Santiago" : "Espacio Providencia",
          address: `Avenida Operaciones ${200 + index}`,
          city: index % 2 === 0 ? "Santiago" : "Providencia",
          region: "Metropolitana de Santiago",
          country: "CL",
          budget: linkedQuotation?.total ?? new Prisma.Decimal(450000 + index * 75000),
          currency: "CLP",
          createdByUserId: user.id,
          createdAt: eventCreatedAt,
          updatedAt: eventUpdatedAt
        }
      });
      events.push(event);
      await prisma.eventTask.createMany({
        data: [0, 1].map((taskIndex) => {
          const taskCreatedAt = new Date(eventCreatedAt.getTime() + taskIndex * 3600000);
          return {
          id: deterministicUuid(`task:${event.id}:${taskIndex}`),
          organizationId,
          eventId: event.id,
          title: taskIndex === 0 ? "Confirmar proveedores" : "Revisar montaje",
          status: event.status === "COMPLETED" ? "COMPLETED" : taskIndex === 0 ? "IN_PROGRESS" : "PENDING",
          priority: taskIndex === 0 ? "URGENT" : "HIGH",
          assignedUserId: user.id,
          dueAt: new Date(new Date(eventDates[index][0]).getTime() - (taskIndex + 1) * 86400000),
          completedAt: event.status === "COMPLETED" ? new Date(eventDates[index][1]) : null,
          createdByUserId: user.id,
          createdAt: taskCreatedAt,
          updatedAt: event.status === "COMPLETED" ? endAt : taskCreatedAt
          };
        })
      });
      await prisma.eventParticipant.create({
        data: {
          id: deterministicUuid(`participant:${event.id}`),
          organizationId,
          eventId: event.id,
          clientId: event.clientId,
          role: "CLIENT_CONTACT",
          notes: "Contacto principal del cliente.",
          createdAt: eventCreatedAt
        }
      });
      await prisma.eventResource.create({
        data: {
          id: deterministicUuid(`resource:${event.id}`),
          organizationId,
          eventId: event.id,
          catalogItemId: catalogItems[index].id,
          name: catalogItems[index].name,
          quantity: new Prisma.Decimal(index + 1),
          unit: catalogItems[index].unit,
          unitCost: catalogItems[index].cost,
          createdAt: eventCreatedAt,
          updatedAt: eventCreatedAt
        }
      });
      await prisma.eventTimelineEntry.create({
        data: {
          id: deterministicUuid(`event-timeline:${event.id}`),
          organizationId,
          eventId: event.id,
          title: "Inicio de operación",
          description: "Recepción del equipo y preparación del espacio.",
          startsAt: new Date(eventDates[index][0]),
          endsAt: new Date(new Date(eventDates[index][0]).getTime() + 3600000),
          sortOrder: 1,
          createdAt: eventCreatedAt,
          updatedAt: eventCreatedAt
        }
      });
    }

    const auditData = [
      ...clients.map((client) => ({ action: "client.created", targetType: "client", targetId: client.id, createdAt: client.createdAt })),
      ...quotations.flatMap((quotation) => {
        const entries = [{ action: "quotation.created", targetType: "quotation", targetId: quotation.id, createdAt: quotation.createdAt }];
        if (quotation.sentAt) entries.push({ action: "quotation.sent", targetType: "quotation", targetId: quotation.id, createdAt: quotation.sentAt });
        if (quotation.approvedAt) entries.push({ action: "quotation.approved", targetType: "quotation", targetId: quotation.id, createdAt: quotation.approvedAt });
        if (quotation.rejectedAt) entries.push({ action: "quotation.rejected", targetType: "quotation", targetId: quotation.id, createdAt: quotation.rejectedAt });
        return entries;
      }),
      ...events.map((event) => ({ action: `event.${event.status.toLowerCase() === "completed" ? "completed" : "created"}`, targetType: "event", targetId: event.id, createdAt: event.updatedAt }))
    ];
    await prisma.organizationAuditLog.createMany({
      data: auditData.map((entry, index) => ({
        id: deterministicUuid(`audit:${organizationId}:${index}`),
        organizationId,
        actorUserId: user.id,
        ...entry
      }))
    });
  }
}

export async function verifyDemoData(prisma) {
  const emails = DEMO_ORGANIZATIONS.map((organization) => organization.email);
  const slugs = DEMO_ORGANIZATIONS.map((organization) => organization.slug);
  const users = await prisma.user.findMany({ where: { email: { in: emails } }, include: { organizationMemberships: true } });
  const organizations = await prisma.organization.findMany({ where: { slug: { in: slugs } }, orderBy: { slug: "asc" } });
  const organizationIds = organizations.map((organization) => organization.id);
  const [clients, catalogItems, quotations, events] = await Promise.all([
    prisma.client.findMany({ where: { organizationId: { in: organizationIds } } }),
    prisma.catalogItem.findMany({ where: { organizationId: { in: organizationIds } } }),
    prisma.quotation.findMany({ where: { organizationId: { in: organizationIds } }, include: { items: true, client: true } }),
    prisma.event.findMany({ where: { organizationId: { in: organizationIds } }, include: { client: true, quotation: true, tasks: true, participants: true, resources: true } })
  ]);

  const errors = [];
  assertCount(errors, "usuarios", users.length, 4);
  assertCount(errors, "organizaciones", organizations.length, 4);
  assertCount(errors, "clientes", clients.length, 40);
  assertCount(errors, "catálogo", catalogItems.length, 48);
  assertCount(errors, "cotizaciones", quotations.length, 32);
  assertCount(errors, "eventos", events.length, 20);

  for (const organization of organizations) {
    if (!organization.taxId || !isValidRut(organization.taxId)) errors.push(`RUT de organización inválido: ${organization.slug}`);
    assertCount(errors, `clientes de ${organization.slug}`, clients.filter((item) => item.organizationId === organization.id).length, 10);
    assertCount(errors, `catálogo de ${organization.slug}`, catalogItems.filter((item) => item.organizationId === organization.id).length, 12);
    assertCount(errors, `cotizaciones de ${organization.slug}`, quotations.filter((item) => item.organizationId === organization.id).length, 8);
    assertCount(errors, `eventos de ${organization.slug}`, events.filter((item) => item.organizationId === organization.id).length, 5);
  }

  for (const client of clients.filter((item) => item.taxId)) {
    if (!isValidRut(client.taxId)) errors.push(`RUT de cliente inválido: ${client.id}`);
  }
  for (const user of users) {
    if (user.organizationMemberships.length !== 1 || user.organizationMemberships[0].role !== "OWNER") {
      errors.push(`Propiedad demo incoherente para ${user.email}`);
    }
  }
  for (const quotation of quotations) {
    const subtotal = quotation.items.reduce((sum, item) => sum.add(item.subtotal), new Prisma.Decimal(0));
    const discount = quotation.items.reduce((sum, item) => sum.add(item.discountTotal), new Prisma.Decimal(0));
    const tax = quotation.items.reduce((sum, item) => sum.add(item.taxTotal), new Prisma.Decimal(0));
    const total = quotation.items.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));
    if (!subtotal.equals(quotation.subtotal) || !discount.equals(quotation.discountTotal) || !tax.equals(quotation.taxTotal) || !total.equals(quotation.total)) {
      errors.push(`Totales incoherentes en ${quotation.number}`);
    }
    if (quotation.client.organizationId !== quotation.organizationId || quotation.items.some((item) => item.catalogItemId && !catalogItems.some((catalogItem) => catalogItem.id === item.catalogItemId && catalogItem.organizationId === quotation.organizationId))) {
      errors.push(`Referencia multiempresa inválida en ${quotation.number}`);
    }
  }
  for (const event of events) {
    const references = [event.client?.organizationId, event.quotation?.organizationId, ...event.tasks.map((item) => item.organizationId), ...event.participants.map((item) => item.organizationId), ...event.resources.map((item) => item.organizationId)].filter(Boolean);
    if (references.some((organizationId) => organizationId !== event.organizationId)) errors.push(`Referencia multiempresa inválida en ${event.code}`);
    if (event.quotation && event.quotation.status !== "APPROVED") errors.push(`Evento ${event.code} vinculado a cotización no aprobada`);
  }

  return {
    ok: errors.length === 0,
    errors,
    counts: { users: users.length, organizations: organizations.length, clients: clients.length, catalogItems: catalogItems.length, quotations: quotations.length, events: events.length },
    verifiedAt: "deterministic-demo-v1"
  };
}

function assertCount(errors, label, actual, expected) {
  if (actual !== expected) errors.push(`${label}: se esperaban ${expected}, se encontraron ${actual}`);
}

export function createDemoPrismaClient() {
  return new PrismaClient();
}
