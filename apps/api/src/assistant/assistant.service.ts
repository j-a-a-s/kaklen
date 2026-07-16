import { Injectable, NotFoundException } from "@nestjs/common";
import { OrganizationRole, Prisma } from "@prisma/client";
import { permissionsForRole } from "../organizations/permissions";
import { PrismaService } from "../prisma/prisma.service";
import {
  AssistedDashboard,
  ClientTimelineItem,
  GlobalSearchResponse,
  GlobalSearchResult,
  OrganizationActivityItem
} from "./assistant.types";
import { UserActivationService } from "./user-activation.service";

interface SearchRow {
  id: string;
  title: string;
  subtitle: string | null;
  status: string;
  match: string;
}

@Injectable()
export class AssistantService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activationService: UserActivationService
  ) {}

  async search(organizationId: string, role: OrganizationRole, rawQuery: string, limit = 5): Promise<GlobalSearchResponse> {
    const query = rawQuery.trim();
    const permissions = permissionsForRole(role);
    const [clients, catalogItems, quotations, events] = await Promise.all([
      permissions.includes("clients.read") ? this.searchClients(organizationId, query, limit) : Promise.resolve([]),
      permissions.includes("catalog.read") ? this.searchCatalog(organizationId, query, limit) : Promise.resolve([]),
      permissions.includes("quotations.read") ? this.searchQuotations(organizationId, query, limit) : Promise.resolve([]),
      permissions.includes("events.read") ? this.searchEvents(organizationId, query, limit) : Promise.resolve([])
    ]);
    return {
      query,
      groups: {
        clients: clients.map((item) => this.mapSearch(item, "client", organizationId, "clients")),
        catalogItems: catalogItems.map((item) => this.mapSearch(item, "catalog_item", organizationId, "catalog")),
        quotations: quotations.map((item) => this.mapSearch(item, "quotation", organizationId, "quotations")),
        events: events.map((item) => this.mapSearch(item, "event", organizationId, "events"))
      }
    };
  }

  async dashboard(organizationId: string, role: OrganizationRole): Promise<AssistedDashboard> {
    const permissions = permissionsForRole(role);
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);
    const [
      activation,
      upcomingEvents,
      pendingQuotations,
      urgentTasks,
      staleClients,
      recentActivity,
      upcomingEventsCount,
      pendingQuotationsCount,
      expiringQuotationsCount,
      urgentTasksCount,
      staleClientsCount
    ] = await Promise.all([
      this.activationService.calculate(organizationId),
      permissions.includes("events.read")
        ? this.prisma.event.findMany({ where: { organizationId, archivedAt: null, startAt: { gte: now }, status: { notIn: ["CANCELLED", "ARCHIVED"] } }, orderBy: { startAt: "asc" }, take: 5 })
        : Promise.resolve([]),
      permissions.includes("quotations.read")
        ? this.prisma.quotation.findMany({ where: { organizationId, archivedAt: null, status: "SENT" }, include: { client: { select: { displayName: true } } }, orderBy: { validUntil: "asc" }, take: 5 })
        : Promise.resolve([]),
      permissions.includes("events.read")
        ? this.prisma.eventTask.findMany({ where: { organizationId, status: { notIn: ["COMPLETED", "CANCELLED"] }, priority: { in: ["HIGH", "URGENT"] }, OR: [{ dueAt: null }, { dueAt: { lte: sevenDays } }] }, include: { event: { select: { name: true } } }, orderBy: [{ priority: "desc" }, { dueAt: "asc" }], take: 5 })
        : Promise.resolve([]),
      permissions.includes("clients.read")
        ? this.prisma.client.findMany({ where: { organizationId, archivedAt: null, status: { not: "ARCHIVED" }, interactions: { none: { occurredAt: { gte: thirtyDaysAgo } } } }, orderBy: { updatedAt: "asc" }, take: 5 })
        : Promise.resolve([]),
      this.activity(organizationId, role, 8),
      permissions.includes("events.read")
        ? this.prisma.event.count({ where: { organizationId, archivedAt: null, startAt: { gte: now }, status: { notIn: ["CANCELLED", "ARCHIVED"] } } })
        : Promise.resolve(0),
      permissions.includes("quotations.read")
        ? this.prisma.quotation.count({ where: { organizationId, archivedAt: null, status: "SENT" } })
        : Promise.resolve(0),
      permissions.includes("quotations.read")
        ? this.prisma.quotation.count({ where: { organizationId, archivedAt: null, status: "SENT", validUntil: { lte: sevenDays } } })
        : Promise.resolve(0),
      permissions.includes("events.read")
        ? this.prisma.eventTask.count({ where: { organizationId, status: { notIn: ["COMPLETED", "CANCELLED"] }, priority: { in: ["HIGH", "URGENT"] }, OR: [{ dueAt: null }, { dueAt: { lte: sevenDays } }] } })
        : Promise.resolve(0),
      permissions.includes("clients.read")
        ? this.prisma.client.count({ where: { organizationId, archivedAt: null, status: { not: "ARCHIVED" }, interactions: { none: { occurredAt: { gte: thirtyDaysAgo } } } } })
        : Promise.resolve(0)
    ]);

    const expiringQuotations = pendingQuotations.filter((quotation) => quotation.validUntil <= sevenDays);
    const recommendedAction = !activation.isCompleted
      ? { kind: activation.nextRecommendedAction, route: this.activationRoute(organizationId, activation.nextRecommendedAction), resourceId: null }
      : expiringQuotations[0]
        ? { kind: "quotation_expiring", route: `/organizations/${organizationId}/quotations/${expiringQuotations[0].id}`, resourceId: expiringQuotations[0].id }
        : upcomingEvents[0]
          ? { kind: "event_upcoming", route: `/organizations/${organizationId}/events/${upcomingEvents[0].id}`, resourceId: upcomingEvents[0].id }
          : urgentTasks[0]
            ? { kind: "task_urgent", route: `/organizations/${organizationId}/events/${urgentTasks[0].eventId}`, resourceId: urgentTasks[0].id }
            : staleClients[0]
              ? { kind: "client_follow_up", route: `/organizations/${organizationId}/clients/${staleClients[0].id}`, resourceId: staleClients[0].id }
              : { kind: "create_opportunity", route: `/organizations/${organizationId}/quotations/new`, resourceId: null };

    return {
      activation,
      counts: {
        upcomingEvents: upcomingEventsCount,
        pendingQuotations: pendingQuotationsCount,
        expiringQuotations: expiringQuotationsCount,
        urgentTasks: urgentTasksCount,
        clientsWithoutRecentInteraction: staleClientsCount
      },
      upcomingEvents: upcomingEvents.map((event) => ({ id: event.id, name: event.name, startAt: event.startAt.toISOString(), status: event.status, route: `/organizations/${organizationId}/events/${event.id}` })),
      pendingQuotations: pendingQuotations.map((quotation) => ({ id: quotation.id, number: quotation.number, validUntil: quotation.validUntil.toISOString(), status: quotation.status, clientName: quotation.client.displayName, route: `/organizations/${organizationId}/quotations/${quotation.id}` })),
      urgentTasks: urgentTasks.map((task) => ({ id: task.id, title: task.title, dueAt: task.dueAt?.toISOString() ?? null, eventName: task.event.name, route: `/organizations/${organizationId}/events/${task.eventId}` })),
      staleClients: staleClients.map((client) => ({ id: client.id, displayName: client.displayName, updatedAt: client.updatedAt.toISOString(), route: `/organizations/${organizationId}/clients/${client.id}` })),
      recentActivity,
      recommendedAction
    };
  }

  async activity(organizationId: string, role: OrganizationRole, limit = 10): Promise<OrganizationActivityItem[]> {
    const permissions = permissionsForRole(role);
    const logs = await this.prisma.organizationAuditLog.findMany({
      where: { organizationId },
      include: { actor: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
      take: Math.min(limit * 3, 90)
    });
    const clientIds = logs.filter((item) => item.targetType === "client" && item.targetId).map((item) => item.targetId as string);
    const catalogIds = logs.filter((item) => item.targetType === "catalog_item" && item.targetId).map((item) => item.targetId as string);
    const quotationIds = logs.filter((item) => item.targetType === "quotation" && item.targetId).map((item) => item.targetId as string);
    const eventIds = logs.filter((item) => item.targetType === "event" && item.targetId).map((item) => item.targetId as string);
    const [clients, catalog, quotations, events, organization] = await Promise.all([
      this.prisma.client.findMany({ where: { organizationId, id: { in: clientIds } }, select: { id: true, displayName: true, status: true } }),
      this.prisma.catalogItem.findMany({ where: { organizationId, id: { in: catalogIds } }, select: { id: true, name: true, status: true } }),
      this.prisma.quotation.findMany({ where: { organizationId, id: { in: quotationIds } }, select: { id: true, number: true, status: true } }),
      this.prisma.event.findMany({ where: { organizationId, id: { in: eventIds } }, select: { id: true, name: true, status: true } }),
      this.prisma.organization.findFirst({ where: { id: organizationId }, select: { id: true, name: true, status: true } })
    ]);
    const resources = new Map<string, { type: GlobalSearchResult["type"] | "organization"; title: string; status: string | null; route: string }>();
    clients.forEach((item) => resources.set(item.id, { type: "client", title: item.displayName, status: item.status, route: `/organizations/${organizationId}/clients/${item.id}` }));
    catalog.forEach((item) => resources.set(item.id, { type: "catalog_item", title: item.name, status: item.status, route: `/organizations/${organizationId}/catalog/${item.id}` }));
    quotations.forEach((item) => resources.set(item.id, { type: "quotation", title: item.number, status: item.status, route: `/organizations/${organizationId}/quotations/${item.id}` }));
    events.forEach((item) => resources.set(item.id, { type: "event", title: item.name, status: item.status, route: `/organizations/${organizationId}/events/${item.id}` }));
    if (organization) resources.set(organization.id, { type: "organization", title: organization.name, status: organization.status, route: `/organizations/${organizationId}/settings` });
    return logs.flatMap((log) => {
      const resource = log.targetId ? resources.get(log.targetId) : undefined;
      if (!resource || !this.canReadResource(permissions, resource.type)) return [];
      return [{ id: log.id, action: log.action, actor: { id: log.actor.id, name: `${log.actor.firstName} ${log.actor.lastName}` }, resource: { id: log.targetId as string, ...resource }, occurredAt: log.createdAt.toISOString() }];
    }).slice(0, limit);
  }

  async clientTimeline(organizationId: string, clientId: string): Promise<ClientTimelineItem[]> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) throw new NotFoundException("Client not found");
    const [interactions, quotations, events] = await Promise.all([
      this.prisma.clientInteraction.findMany({ where: { organizationId, clientId }, include: { user: { select: { id: true, firstName: true, lastName: true } } } }),
      this.prisma.quotation.findMany({ where: { organizationId, clientId }, select: { id: true, number: true, status: true } }),
      this.prisma.event.findMany({ where: { organizationId, clientId }, select: { id: true, name: true, status: true } })
    ]);
    const quotationIds = quotations.map((item) => item.id);
    const eventIds = events.map((item) => item.id);
    const logs = await this.prisma.organizationAuditLog.findMany({
      where: { organizationId, OR: [{ targetType: "client", targetId: clientId }, { targetType: "quotation", targetId: { in: quotationIds } }, { targetType: "event", targetId: { in: eventIds } }] },
      include: { actor: { select: { id: true, firstName: true, lastName: true } } }
    });
    const quotationsById = new Map(quotations.map((item) => [item.id, item]));
    const eventsById = new Map(events.map((item) => [item.id, item]));
    const timeline: ClientTimelineItem[] = interactions.map((interaction) => ({
      id: interaction.id,
      type: `interaction.${interaction.type.toLowerCase()}`,
      description: interaction.subject ?? interaction.description,
      actor: { id: interaction.user.id, name: `${interaction.user.firstName} ${interaction.user.lastName}` },
      resource: { id: client.id, type: "client", title: client.displayName, route: `/organizations/${organizationId}/clients/${client.id}` },
      status: null,
      occurredAt: interaction.occurredAt.toISOString()
    }));
    for (const log of logs) {
      const quotation = log.targetId ? quotationsById.get(log.targetId) : undefined;
      const event = log.targetId ? eventsById.get(log.targetId) : undefined;
      const resource = quotation
        ? { id: quotation.id, type: "quotation", title: quotation.number, route: `/organizations/${organizationId}/quotations/${quotation.id}` }
        : event
          ? { id: event.id, type: "event", title: event.name, route: `/organizations/${organizationId}/events/${event.id}` }
          : { id: client.id, type: "client", title: client.displayName, route: `/organizations/${organizationId}/clients/${client.id}` };
      timeline.push({ id: log.id, type: log.action, description: log.action, actor: { id: log.actor.id, name: `${log.actor.firstName} ${log.actor.lastName}` }, resource, status: quotation?.status ?? event?.status ?? client.status, occurredAt: log.createdAt.toISOString() });
    }
    return timeline.sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  }

  private async searchClients(organizationId: string, query: string, limit: number): Promise<SearchRow[]> {
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT id, "displayName" AS title, COALESCE(email, "taxId", '') AS subtitle, status::text, "displayName" AS match FROM "Client" WHERE "organizationId" = ${organizationId} AND "archivedAt" IS NULL AND unaccent(lower(concat_ws(' ', "displayName", email, "taxId"))) LIKE '%' || unaccent(lower(${query})) || '%' ORDER BY "displayName" ASC LIMIT ${limit}`);
  }

  private async searchCatalog(organizationId: string, query: string, limit: number): Promise<SearchRow[]> {
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT id, name AS title, concat_ws(' · ', code, sku) AS subtitle, status::text, name AS match FROM "CatalogItem" WHERE "organizationId" = ${organizationId} AND "archivedAt" IS NULL AND unaccent(lower(concat_ws(' ', name, code, sku))) LIKE '%' || unaccent(lower(${query})) || '%' ORDER BY name ASC LIMIT ${limit}`);
  }

  private async searchQuotations(organizationId: string, query: string, limit: number): Promise<SearchRow[]> {
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT q.id, q.number AS title, c."displayName" AS subtitle, q.status::text, concat_ws(' ', q.number, c."displayName") AS match FROM "Quotation" q JOIN "Client" c ON c.id = q."clientId" AND c."organizationId" = q."organizationId" WHERE q."organizationId" = ${organizationId} AND q."archivedAt" IS NULL AND unaccent(lower(concat_ws(' ', q.number, c."displayName"))) LIKE '%' || unaccent(lower(${query})) || '%' ORDER BY q."updatedAt" DESC LIMIT ${limit}`);
  }

  private async searchEvents(organizationId: string, query: string, limit: number): Promise<SearchRow[]> {
    return this.prisma.$queryRaw<SearchRow[]>(Prisma.sql`SELECT id, name AS title, concat_ws(' · ', code, "venueName", city) AS subtitle, status::text, concat_ws(' ', name, code) AS match FROM "Event" WHERE "organizationId" = ${organizationId} AND "archivedAt" IS NULL AND unaccent(lower(concat_ws(' ', name, code, "venueName", city))) LIKE '%' || unaccent(lower(${query})) || '%' ORDER BY "startAt" DESC LIMIT ${limit}`);
  }

  private mapSearch(item: SearchRow, type: GlobalSearchResult["type"], organizationId: string, segment: string): GlobalSearchResult {
    return { id: item.id, type, title: item.title, subtitle: item.subtitle ?? "", status: item.status, route: `/organizations/${organizationId}/${segment}/${item.id}`, match: item.match };
  }

  private activationRoute(organizationId: string, action: string): string {
    const routes: Record<string, string> = {
      organization_configured: `/organizations/${organizationId}/settings`,
      first_client_created: `/organizations/${organizationId}/clients/new`,
      first_catalog_item_created: `/organizations/${organizationId}/catalog/new`,
      first_quotation_created: `/organizations/${organizationId}/quotations/new`,
      first_quotation_sent: `/organizations/${organizationId}/quotations`,
      first_quotation_approved: `/organizations/${organizationId}/quotations`,
      first_event_created: `/organizations/${organizationId}/events/new`
    };
    return routes[action] ?? `/organizations/${organizationId}/quotations/new`;
  }

  private canReadResource(permissions: readonly string[], type: string): boolean {
    if (type === "client") return permissions.includes("clients.read");
    if (type === "catalog_item") return permissions.includes("catalog.read");
    if (type === "quotation") return permissions.includes("quotations.read");
    if (type === "event") return permissions.includes("events.read");
    return permissions.includes("organization.read");
  }
}
