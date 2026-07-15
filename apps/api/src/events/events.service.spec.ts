import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  CatalogItemStatus,
  CatalogItemType,
  Event,
  EventParticipantRole,
  EventStatus,
  EventTaskPriority,
  EventTaskStatus,
  Prisma,
  QuotationStatus
} from "@prisma/client";
import { EventsService } from "./events.service";

type TransitionProbe = {
  assertTransition(previous: EventStatus, next: EventStatus): void;
};

type DatesProbe = {
  assertDates(startAt: string, endAt: string): void;
};

type CodeProbe = {
  nextCode(
    organizationId: string,
    tx: { event: { findFirst(args: unknown): Promise<{ code: string } | null> } }
  ): Promise<string>;
};

type WhereProbe = {
  buildWhere(organizationId: string, query: { search?: string; includeArchived?: boolean; city?: string }): unknown;
};

describe("EventsService", () => {
  const service = new EventsService({} as ConstructorParameters<typeof EventsService>[0]);

  it("rejects invalid event date ranges", () => {
    const probe = service as unknown as DatesProbe;

    expect(() => probe.assertDates("2026-07-10T12:00:00.000Z", "2026-07-10T12:00:00.000Z")).toThrow(BadRequestException);
    expect(() => probe.assertDates("2026-07-10T13:00:00.000Z", "2026-07-10T12:00:00.000Z")).toThrow(BadRequestException);
  });

  it("accepts valid event date ranges", () => {
    const probe = service as unknown as DatesProbe;

    expect(() => probe.assertDates("2026-07-10T12:00:00.000Z", "2026-07-10T13:00:00.000Z")).not.toThrow();
  });

  it("allows valid status transitions", () => {
    const probe = service as unknown as TransitionProbe;

    expect(() => probe.assertTransition(EventStatus.DRAFT, EventStatus.CONFIRMED)).not.toThrow();
    expect(() => probe.assertTransition(EventStatus.CONFIRMED, EventStatus.IN_PROGRESS)).not.toThrow();
    expect(() => probe.assertTransition(EventStatus.IN_PROGRESS, EventStatus.COMPLETED)).not.toThrow();
  });

  it("rejects invalid status transitions", () => {
    const probe = service as unknown as TransitionProbe;

    expect(() => probe.assertTransition(EventStatus.COMPLETED, EventStatus.IN_PROGRESS)).toThrow(BadRequestException);
    expect(() => probe.assertTransition(EventStatus.CANCELLED, EventStatus.CONFIRMED)).toThrow(BadRequestException);
  });

  it("generates sequential event codes", async () => {
    const probe = service as unknown as CodeProbe;
    const code = await probe.nextCode("org-1", {
      event: {
        findFirst: async () => ({ code: "EVT-000041" })
      }
    });

    expect(code).toBe("EVT-000042");
  });

  it("starts event codes at one", async () => {
    const probe = service as unknown as CodeProbe;
    const code = await probe.nextCode("org-1", {
      event: {
        findFirst: async () => null
      }
    });

    expect(code).toBe("EVT-000001");
  });

  it("excludes archived events by default", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", {})).toMatchObject({
      organizationId: "org-1",
      archivedAt: null,
      status: { not: EventStatus.ARCHIVED }
    });
  });

  it("allows archived events when requested", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", { includeArchived: true })).toEqual({ organizationId: "org-1" });
  });

  it("builds organization-scoped search filters", () => {
    const probe = service as unknown as WhereProbe;

    expect(probe.buildWhere("org-1", { search: " gala ", city: "Santiago" })).toMatchObject({
      organizationId: "org-1",
      city: { contains: "Santiago", mode: "insensitive" }
    });
  });

  it("creates an event with organization defaults and audit entry", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    const created = await realService.create("org-1", "user-1", {
      name: "  Gala anual ",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z",
      clientId: "client-1",
      description: "  Bienvenida ",
      country: "cl",
      currency: "clp",
      budget: 1500
    });

    expect(created.id).toBe("event-1");
    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { id: "client-1", organizationId: "org-1", archivedAt: null } });
    expect(callData(prisma.event.create)).toMatchObject({
      organizationId: "org-1",
      code: "EVT-000002",
      name: "Gala anual",
      timezone: "America/Santiago",
      country: "CL",
      currency: "CLP",
      createdByUserId: "user-1"
    });
    expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
      data: { organizationId: "org-1", actorUserId: "user-1", action: "event.created", targetType: "event", targetId: "event-1" }
    });
  });

  it("rejects events for clients outside the organization", async () => {
    const prisma = makeEventsPrisma({ client: null });
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await expect(
      realService.create("org-1", "user-1", {
        name: "Gala",
        startAt: "2026-08-01T10:00:00.000Z",
        endAt: "2026-08-01T12:00:00.000Z",
        clientId: "client-b"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("creates an event from an approved quotation and snapshots resources", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createFromQuotation("org-1", "quotation-1", "user-1", {
      name: "Evento desde cotizacion",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z"
    });

    expect(callData(prisma.event.create)).toMatchObject({
      clientId: "client-1",
      quotationId: "quotation-1",
      budget: new Prisma.Decimal(1190),
      currency: "CLP",
      resources: {
        create: [
          {
            organizationId: "org-1",
            catalogItemId: "catalog-1",
            name: "Sonido",
            quantity: new Prisma.Decimal(1),
            unit: "service",
            unitCost: new Prisma.Decimal(1000),
            notes: "Audio"
          }
        ]
      }
    });
  });

  it("rejects creating events from quotations that are not approved", async () => {
    const prisma = makeEventsPrisma({ quotationStatus: QuotationStatus.SENT });
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await expect(
      realService.createFromQuotation("org-1", "quotation-1", "user-1", {
        name: "Evento",
        startAt: "2026-08-01T10:00:00.000Z",
        endAt: "2026-08-01T12:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists, summarizes, and exposes calendar events by organization", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await expect(realService.list("org-1", { page: 2, pageSize: 5, sortBy: "name", sortDirection: "desc" })).resolves.toMatchObject({
      page: 2,
      pageSize: 5,
      total: 1,
      totalPages: 1
    });
    await expect(realService.summary("org-1")).resolves.toMatchObject({
      total: 2,
      draft: 1,
      confirmed: 1,
      inProgress: 0
    });
    await expect(
      realService.calendar("org-1", { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.000Z" })
    ).resolves.toHaveLength(1);
  });

  it("blocks edits to completed or cancelled events according to lifecycle rules", async () => {
    const cancelled = makeEventsPrisma({ event: event({ status: EventStatus.CANCELLED }) });
    const completed = makeEventsPrisma({ event: event({ status: EventStatus.COMPLETED }) });

    await expect(
      new EventsService(cancelled as unknown as ConstructorParameters<typeof EventsService>[0]).update("org-1", "event-1", "user-1", {
        name: "Nueva fecha"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new EventsService(completed as unknown as ConstructorParameters<typeof EventsService>[0]).update("org-1", "event-1", "user-1", {
        notes: "Nota administrativa"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates editable events and archives with audit trail", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.update("org-1", "event-1", "user-1", {
      name: "  Gala final ",
      startAt: "2026-08-01T11:00:00.000Z",
      endAt: "2026-08-01T13:00:00.000Z",
      country: "br",
      budget: null
    });
    await realService.archive("org-1", "event-1", "user-1");

    expect(callData(prisma.event.update)).toMatchObject({
      name: "Gala final",
      country: "BR",
      budget: null
    });
    expect(callData(prisma.event.update, 1)).toMatchObject({
      status: EventStatus.ARCHIVED,
      archivedAt: expect.any(Date)
    });
  });

  it("changes status through valid event transitions and rejects invalid transitions", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.confirm("org-1", "event-1", "user-1");
    prisma.event.findFirst.mockResolvedValueOnce(event({ status: EventStatus.ARCHIVED }));

    expect(callData(prisma.event.update)).toEqual({ status: EventStatus.CONFIRMED });
    await expect(realService.start("org-1", "event-1", "user-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("manages event tasks and validates assignees", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createTask("org-1", "event-1", "user-1", {
      title: " Montaje ",
      status: EventTaskStatus.COMPLETED,
      priority: EventTaskPriority.HIGH,
      assignedUserId: "user-2",
      dueAt: "2026-08-01T09:00:00.000Z"
    });
    await realService.listTasks("org-1", "event-1");
    await realService.updateTask("org-1", "event-1", "task-1", "user-1", {
      title: "Prueba de sonido",
      status: EventTaskStatus.PENDING,
      priority: EventTaskPriority.MEDIUM
    });
    await realService.deleteTask("org-1", "event-1", "task-1");

    expect(prisma.organizationMembership.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: "user-2", status: "ACTIVE" }
    });
    expect(callData(prisma.eventTask.create)).toMatchObject({
      title: "Montaje",
      completedAt: expect.any(Date)
    });
    expect(callData(prisma.eventTask.update)).toMatchObject({
      completedAt: null
    });
  });

  it("rejects missing participants and cross-organization participant references", async () => {
    const prisma = makeEventsPrisma({ member: null, client: null });
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await expect(realService.createParticipant("org-1", "event-1", { role: EventParticipantRole.GUEST })).rejects.toBeInstanceOf(
      BadRequestException
    );
    await expect(
      realService.createParticipant("org-1", "event-1", { role: EventParticipantRole.STAFF, userId: "user-b" })
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      realService.createParticipant("org-1", "event-1", { role: EventParticipantRole.CLIENT_CONTACT, clientId: "client-b" })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("manages external participants", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createParticipant("org-1", "event-1", {
      role: EventParticipantRole.GUEST,
      externalName: " Invitada ",
      externalEmail: "guest@example.com"
    });
    await realService.listParticipants("org-1", "event-1");
    await realService.deleteParticipant("org-1", "event-1", "participant-1");

    expect(callData(prisma.eventParticipant.create)).toMatchObject({
      externalName: "Invitada",
      externalEmail: "guest@example.com"
    });
  });

  it("rejects deleting a participant from another organization", async () => {
    const prisma = makeEventsPrisma({ participant: null });
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await expect(realService.deleteParticipant("org-1", "event-1", "participant-b")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("manages catalog-backed event resources and rejects foreign catalog items", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createResource("org-1", "event-1", {
      catalogItemId: "catalog-1",
      name: "Ignorado",
      quantity: 2,
      unit: "ignored"
    });
    await realService.listResources("org-1", "event-1");
    await realService.updateResource("org-1", "event-1", "resource-1", {
      name: "Mesa",
      quantity: 3,
      unit: "unit",
      unitCost: null
    });
    await realService.deleteResource("org-1", "event-1", "resource-1");

    expect(callData(prisma.eventResource.create)).toMatchObject({
      catalogItemId: "catalog-1",
      name: "Sonido",
      quantity: new Prisma.Decimal(2),
      unit: "service",
      unitCost: new Prisma.Decimal(100)
    });

    mockResolvedValueOnce(prisma.catalogItem.findFirst, null);
    await expect(
      realService.createResource("org-1", "event-1", {
        catalogItemId: "catalog-b",
        name: "Foraneo",
        quantity: 1,
        unit: "unit"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("manages timeline entries and validates optional end dates", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createTimelineEntry("org-1", "event-1", {
      title: " Apertura ",
      startsAt: "2026-08-01T10:00:00.000Z",
      endsAt: "2026-08-01T10:30:00.000Z"
    });
    await realService.listTimeline("org-1", "event-1");
    await realService.updateTimelineEntry("org-1", "event-1", "timeline-1", {
      title: "Cierre",
      startsAt: "2026-08-01T11:00:00.000Z",
      endsAt: "2026-08-01T11:30:00.000Z"
    });
    await realService.deleteTimelineEntry("org-1", "event-1", "timeline-1");

    expect(prisma.eventTimelineEntry.count).toHaveBeenCalledWith({ where: { organizationId: "org-1", eventId: "event-1" } });
    await expect(
      realService.createTimelineEntry("org-1", "event-1", {
        title: "Error",
        startsAt: "2026-08-01T11:00:00.000Z",
        endsAt: "2026-08-01T10:30:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("creates minimal events without optional client or quotation references", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.create("org-1", "user-1", {
      name: "Minimal",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z"
    });

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(callData(prisma.event.create)).toMatchObject({
      clientId: undefined,
      quotationId: undefined,
      description: null,
      country: "CL",
      currency: "CLP"
    });
  });

  it("validates quotationId on direct event creation", async () => {
    const approved = makeEventsPrisma();
    const rejected = makeEventsPrisma({ quotationStatus: QuotationStatus.SENT });

    await expect(
      new EventsService(approved as unknown as ConstructorParameters<typeof EventsService>[0]).create("org-1", "user-1", {
        name: "With quotation",
        quotationId: "quotation-1",
        startAt: "2026-08-01T10:00:00.000Z",
        endAt: "2026-08-01T12:00:00.000Z"
      })
    ).resolves.toMatchObject({ id: "event-1" });
    await expect(
      new EventsService(rejected as unknown as ConstructorParameters<typeof EventsService>[0]).create("org-1", "user-1", {
        name: "With quotation",
        quotationId: "quotation-1",
        startAt: "2026-08-01T10:00:00.000Z",
        endAt: "2026-08-01T12:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("supports alternate client when creating from an approved quotation", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createFromQuotation("org-1", "quotation-1", "user-1", {
      name: "Alternate client",
      clientId: "client-2",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z"
    });

    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { id: "client-2", organizationId: "org-1", archivedAt: null } });
  });

  it("updates with empty DTO and with nullable administrative fields", async () => {
    const empty = makeEventsPrisma();
    const nullable = makeEventsPrisma();

    await new EventsService(empty as unknown as ConstructorParameters<typeof EventsService>[0]).update("org-1", "event-1", "user-1", {});
    await new EventsService(nullable as unknown as ConstructorParameters<typeof EventsService>[0]).update("org-1", "event-1", "user-1", {
      clientId: null,
      description: null,
      venueName: null,
      address: null,
      city: null,
      region: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      budget: 2500,
      currency: "usd",
      notes: null
    });

    expect(callData(empty.event.update)).toMatchObject({
      clientId: undefined,
      name: undefined,
      budget: undefined
    });
    expect(callData(nullable.event.update)).toMatchObject({
      clientId: null,
      description: null,
      venueName: null,
      budget: new Prisma.Decimal(2500),
      currency: "USD"
    });
  });

  it("rejects missing organizations, tasks, resources, and timeline entries", async () => {
    const prisma = makeEventsPrisma();
    mockResolvedValueOnce(prisma.organization.findFirst, null);
    const missingTask = makeEventsPrisma();
    const missingResource = makeEventsPrisma();
    const missingTimeline = makeEventsPrisma();
    mockResolvedValueOnce(missingTask.eventTask.findFirst, null);
    mockResolvedValueOnce(missingResource.eventResource.findFirst, null);
    mockResolvedValueOnce(missingTimeline.eventTimelineEntry.findFirst, null);

    await expect(
      new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]).create("org-1", "user-1", {
        name: "No org",
        startAt: "2026-08-01T10:00:00.000Z",
        endAt: "2026-08-01T12:00:00.000Z"
      })
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new EventsService(missingTask as unknown as ConstructorParameters<typeof EventsService>[0]).deleteTask("org-1", "event-1", "task-b")
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new EventsService(missingResource as unknown as ConstructorParameters<typeof EventsService>[0]).deleteResource("org-1", "event-1", "resource-b")
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new EventsService(missingTimeline as unknown as ConstructorParameters<typeof EventsService>[0]).deleteTimelineEntry("org-1", "event-1", "timeline-b")
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it("uses custom resource data and explicit timeline order when no catalog or end date is present", async () => {
    const prisma = makeEventsPrisma();
    const realService = new EventsService(prisma as unknown as ConstructorParameters<typeof EventsService>[0]);

    await realService.createResource("org-1", "event-1", {
      name: "Custom chair",
      quantity: 4,
      unit: "unit",
      unitCost: null,
      notes: ""
    });
    await realService.createTimelineEntry("org-1", "event-1", {
      title: "Open doors",
      startsAt: "2026-08-01T10:00:00.000Z",
      sortOrder: 10
    });

    expect(prisma.catalogItem.findFirst).not.toHaveBeenCalled();
    expect(callData(prisma.eventResource.create)).toMatchObject({
      catalogItemId: undefined,
      name: "Custom chair",
      unitCost: null,
      notes: null
    });
    expect(callData(prisma.eventTimelineEntry.create)).toMatchObject({
      endsAt: null,
      sortOrder: 10
    });
  });
});

function makeEventsPrisma(options: {
  event?: Event;
  client?: unknown;
  quotationStatus?: QuotationStatus;
  member?: unknown;
  participant?: unknown;
} = {}) {
  const currentEvent = options.event ?? event();
  const organization = {
    id: "org-1",
    name: "Kaklen",
    timezone: "America/Santiago",
    country: "CL",
    currency: "CLP",
    deletedAt: null
  };
  const catalogItem = {
    id: "catalog-1",
    organizationId: "org-1",
    type: CatalogItemType.SERVICE,
    status: CatalogItemStatus.ACTIVE,
    sku: null,
    code: "SONIDO",
    name: "Sonido",
    description: "Audio",
    unit: "service",
    cost: new Prisma.Decimal(100),
    price: new Prisma.Decimal(1000),
    taxPercent: new Prisma.Decimal(19),
    currency: "CLP",
    trackInventory: false,
    createdByUserId: "user-1",
    createdAt: new Date("2026-07-01T00:00:00.000Z"),
    updatedAt: new Date("2026-07-01T00:00:00.000Z"),
    archivedAt: null
  };
  const client = options.client === undefined ? { id: "client-1", organizationId: "org-1", archivedAt: null } : options.client;
  const member = options.member === undefined ? { id: "membership-1", organizationId: "org-1", userId: "user-2", status: "ACTIVE" } : options.member;
  const participant =
    options.participant === undefined ? { id: "participant-1", organizationId: "org-1", eventId: "event-1" } : options.participant;
  const task = { id: "task-1", organizationId: "org-1", eventId: "event-1" };
  const resource = { id: "resource-1", organizationId: "org-1", eventId: "event-1" };
  const timeline = { id: "timeline-1", organizationId: "org-1", eventId: "event-1", sortOrder: 1 };
  const tx = {
    organization: { findFirst: jest.fn(async () => organization) },
    client: { findFirst: jest.fn(async () => client) },
    quotation: {
      findFirst: jest.fn(async (args?: { where?: { status?: QuotationStatus } }) => {
        const status = options.quotationStatus ?? QuotationStatus.APPROVED;

        if (args?.where?.status !== undefined && args.where.status !== status) {
          return null;
        }

        return {
          id: "quotation-1",
          organizationId: "org-1",
          clientId: "client-1",
          status,
          total: new Prisma.Decimal(1190),
          currency: "CLP",
          items: [
            {
              catalogItemId: "catalog-1",
              name: "Sonido",
              quantity: new Prisma.Decimal(1),
              unit: "service",
              unitPrice: new Prisma.Decimal(1000),
              description: "Audio"
            }
          ]
        };
      })
    },
    catalogItem: { findFirst: jest.fn(async () => catalogItem) },
    organizationMembership: { findFirst: jest.fn(async () => member) },
    event: {
      create: jest.fn(async () => currentEvent),
      findFirst: jest.fn(async () => currentEvent),
      findMany: jest.fn(async () => [
        {
          ...currentEvent,
          client: { displayName: "Cliente demo" }
        }
      ]),
      count: jest.fn(async () => 1),
      groupBy: jest.fn(async () => [
        { status: EventStatus.DRAFT, _count: { _all: 1 } },
        { status: EventStatus.CONFIRMED, _count: { _all: 1 } }
      ]),
      update: jest.fn(async () => currentEvent)
    },
    eventTask: {
      create: jest.fn(async () => task),
      findMany: jest.fn(async () => [task]),
      findFirst: jest.fn(async () => task),
      update: jest.fn(async () => task),
      delete: jest.fn(async () => task)
    },
    eventParticipant: {
      create: jest.fn(async () => participant),
      findMany: jest.fn(async () => [participant]),
      findFirst: jest.fn(async () => participant),
      delete: jest.fn(async () => participant)
    },
    eventResource: {
      create: jest.fn(async () => resource),
      findMany: jest.fn(async () => [resource]),
      findFirst: jest.fn(async () => resource),
      update: jest.fn(async () => resource),
      delete: jest.fn(async () => resource)
    },
    eventTimelineEntry: {
      count: jest.fn(async () => 0),
      create: jest.fn(async () => timeline),
      findMany: jest.fn(async () => [timeline]),
      findFirst: jest.fn(async () => timeline),
      update: jest.fn(async () => timeline),
      delete: jest.fn(async () => timeline)
    },
    organizationAuditLog: { create: jest.fn(async () => ({ id: "audit-1" })) }
  };

  return {
    ...tx,
    $transaction: jest.fn(async (input: unknown) => (Array.isArray(input) ? Promise.all(input) : (input as (transaction: typeof tx) => Promise<unknown>)(tx)))
  };
}

function event(overrides: Partial<Event> = {}): Event {
  const startAt = new Date("2026-08-01T10:00:00.000Z");
  return {
    id: "event-1",
    organizationId: "org-1",
    clientId: "client-1",
    quotationId: null,
    code: "EVT-000001",
    name: "Gala",
    description: null,
    status: EventStatus.DRAFT,
    startAt,
    endAt: new Date("2026-08-01T12:00:00.000Z"),
    timezone: "America/Santiago",
    venueName: null,
    address: null,
    city: "Santiago",
    region: null,
    country: "CL",
    contactName: null,
    contactEmail: null,
    contactPhone: null,
    budget: null,
    currency: "CLP",
    notes: null,
    createdByUserId: "user-1",
    createdAt: startAt,
    updatedAt: startAt,
    archivedAt: null,
    ...overrides
  };
}

function callData(mock: { mock: { calls: unknown[][] } }, callIndex = 0): unknown {
  const call = mock.mock.calls[callIndex]?.[0] as { data?: unknown } | undefined;
  return call?.data;
}

function mockResolvedValueOnce(mock: { mockResolvedValueOnce(value: unknown): unknown }, value: unknown): void {
  mock.mockResolvedValueOnce(value);
}
