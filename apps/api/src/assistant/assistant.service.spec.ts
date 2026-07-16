import { NotFoundException } from "@nestjs/common";
import { OrganizationRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { AssistantService } from "./assistant.service";
import { UserActivationService } from "./user-activation.service";

describe("AssistantService", () => {
  const activationComplete = {
    completedSteps: ["organization_configured", "first_client_created", "first_catalog_item_created", "first_quotation_created", "first_quotation_sent", "first_quotation_approved", "first_event_created"],
    totalSteps: 7,
    percentage: 100,
    currentStep: null,
    nextRecommendedAction: "create_opportunity",
    isCompleted: true
  } as const;

  function createService() {
    const prisma = {
      $queryRaw: jest.fn(),
      organizationAuditLog: { findMany: jest.fn() },
      organization: { findFirst: jest.fn() },
      client: { findMany: jest.fn(), findFirst: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      clientInteraction: { findMany: jest.fn() },
      catalogItem: { findMany: jest.fn() },
      quotation: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      event: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) },
      eventTask: { findMany: jest.fn(), count: jest.fn().mockResolvedValue(0) }
    };
    const activationService = { calculate: jest.fn().mockResolvedValue(activationComplete) };
    const service = new AssistantService(prisma as unknown as PrismaService, activationService as unknown as UserActivationService);
    return { service, prisma, activationService };
  }

  it("searches every readable category inside the requested tenant and limits routes", async () => {
    const { service, prisma } = createService();
    prisma.$queryRaw
      .mockResolvedValueOnce([{ id: "client-1", title: "Ángela", subtitle: "angela@example.test", status: "ACTIVE", match: "Ángela" }])
      .mockResolvedValueOnce([{ id: "catalog-1", title: "Iluminación", subtitle: "LUZ", status: "ACTIVE", match: "Iluminación" }])
      .mockResolvedValueOnce([{ id: "quote-1", title: "Q-0001", subtitle: "Ángela", status: "SENT", match: "Q-0001 Ángela" }])
      .mockResolvedValueOnce([{ id: "event-1", title: "Lanzamiento", subtitle: "EV-001", status: "DRAFT", match: "Lanzamiento" }]);

    const result = await service.search("org-a", OrganizationRole.OWNER, "  áng  ", 3);

    expect(result.query).toBe("áng");
    expect(result.groups.clients[0]).toMatchObject({ type: "client", route: "/organizations/org-a/clients/client-1" });
    expect(result.groups.catalogItems[0]).toMatchObject({ type: "catalog_item", route: "/organizations/org-a/catalog/catalog-1" });
    expect(result.groups.quotations[0]).toMatchObject({ route: "/organizations/org-a/quotations/quote-1" });
    expect(result.groups.events[0]).toMatchObject({ route: "/organizations/org-a/events/event-1" });
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(4);
    for (const call of prisma.$queryRaw.mock.calls) {
      const statement = call[0] as { values: unknown[] };
      expect(statement.values).toContain("org-a");
      expect(statement.values).toContain(3);
    }
  });

  it("prioritizes onboarding before operational dashboard alerts", async () => {
    const { service, prisma, activationService } = createService();
    activationService.calculate.mockResolvedValue({ ...activationComplete, isCompleted: false, currentStep: "first_client_created", nextRecommendedAction: "first_client_created" });
    prisma.event.findMany.mockResolvedValue([{ id: "event-1", name: "Evento", startAt: new Date(Date.now() + 86400000), status: "CONFIRMED" }]);
    prisma.quotation.findMany.mockResolvedValue([{ id: "quote-1", number: "Q-1", validUntil: new Date(Date.now() + 86400000), status: "SENT", client: { displayName: "Cliente" } }]);
    prisma.eventTask.findMany.mockResolvedValue([{ id: "task-1", eventId: "event-1", title: "Tarea", dueAt: null, event: { name: "Evento" } }]);
    prisma.client.findMany.mockResolvedValue([{ id: "client-1", displayName: "Cliente", updatedAt: new Date(0) }]);
    prisma.event.count.mockResolvedValue(7);
    prisma.quotation.count.mockResolvedValueOnce(8).mockResolvedValueOnce(3);
    prisma.eventTask.count.mockResolvedValue(6);
    prisma.client.count.mockResolvedValue(9);
    jest.spyOn(service, "activity").mockResolvedValue([]);

    const result = await service.dashboard("org-a", OrganizationRole.OWNER);

    expect(result.recommendedAction).toEqual({ kind: "first_client_created", route: "/organizations/org-a/clients/new", resourceId: null });
    expect(result.counts).toEqual({ upcomingEvents: 7, pendingQuotations: 8, expiringQuotations: 3, urgentTasks: 6, clientsWithoutRecentInteraction: 9 });
  });

  it("recommends an expiring quotation before events, tasks, and follow-up", async () => {
    const { service, prisma } = createService();
    prisma.event.findMany.mockResolvedValue([{ id: "event-1", name: "Evento", startAt: new Date(Date.now() + 86400000), status: "CONFIRMED" }]);
    prisma.quotation.findMany.mockResolvedValue([{ id: "quote-1", number: "Q-1", validUntil: new Date(Date.now() + 86400000), status: "SENT", client: { displayName: "Cliente" } }]);
    prisma.eventTask.findMany.mockResolvedValue([]);
    prisma.client.findMany.mockResolvedValue([]);
    jest.spyOn(service, "activity").mockResolvedValue([]);

    await expect(service.dashboard("org-a", OrganizationRole.OWNER)).resolves.toMatchObject({
      recommendedAction: { kind: "quotation_expiring", route: "/organizations/org-a/quotations/quote-1", resourceId: "quote-1" }
    });
  });

  it("maps recent tenant activity in batches and omits unresolved resources", async () => {
    const { service, prisma } = createService();
    const occurredAt = new Date("2026-07-01T10:00:00.000Z");
    prisma.organizationAuditLog.findMany.mockResolvedValue([
      { id: "log-1", action: "client.created", targetType: "client", targetId: "client-1", createdAt: occurredAt, actor: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } },
      { id: "log-2", action: "unknown", targetType: "unknown", targetId: "outside", createdAt: occurredAt, actor: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } }
    ]);
    prisma.client.findMany.mockResolvedValue([{ id: "client-1", displayName: "Cliente Demo", status: "ACTIVE" }]);
    prisma.catalogItem.findMany.mockResolvedValue([]);
    prisma.quotation.findMany.mockResolvedValue([]);
    prisma.event.findMany.mockResolvedValue([]);
    prisma.organization.findFirst.mockResolvedValue({ id: "org-a", name: "Org A", status: "ACTIVE" });

    await expect(service.activity("org-a", OrganizationRole.VIEWER, 5)).resolves.toEqual([
      expect.objectContaining({ id: "log-1", action: "client.created", actor: { id: "user-1", name: "Ada Lovelace" }, resource: expect.objectContaining({ route: "/organizations/org-a/clients/client-1" }) })
    ]);
    expect(prisma.client.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ organizationId: "org-a" }) }));
  });

  it("builds a descending client timeline and rejects cross-tenant client ids", async () => {
    const { service, prisma } = createService();
    prisma.client.findFirst.mockResolvedValue({ id: "client-1", organizationId: "org-a", displayName: "Cliente", status: "ACTIVE" });
    prisma.clientInteraction.findMany.mockResolvedValue([{ id: "interaction-1", type: "CALL", subject: "Seguimiento", description: "Detalle", occurredAt: new Date("2026-07-01T10:00:00.000Z"), user: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } }]);
    prisma.quotation.findMany.mockResolvedValue([{ id: "quote-1", number: "Q-1", status: "APPROVED" }]);
    prisma.event.findMany.mockResolvedValue([{ id: "event-1", name: "Evento", status: "COMPLETED" }]);
    prisma.organizationAuditLog.findMany.mockResolvedValue([{ id: "log-1", action: "event.completed", targetType: "event", targetId: "event-1", createdAt: new Date("2026-07-02T10:00:00.000Z"), actor: { id: "user-1", firstName: "Ada", lastName: "Lovelace" } }]);

    const timeline = await service.clientTimeline("org-a", "client-1");
    expect(timeline.map((item) => item.id)).toEqual(["log-1", "interaction-1"]);
    expect(timeline[0]).toMatchObject({ type: "event.completed", status: "COMPLETED", resource: { route: "/organizations/org-a/events/event-1" } });

    prisma.client.findFirst.mockResolvedValueOnce(null);
    await expect(service.clientTimeline("org-b", "client-1")).rejects.toBeInstanceOf(NotFoundException);
  });
});
