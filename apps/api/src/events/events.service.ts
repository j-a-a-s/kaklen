import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CatalogItem,
  Client,
  Event,
  EventParticipant,
  EventResource,
  EventStatus,
  EventTask,
  EventTaskStatus,
  EventTimelineEntry,
  Organization,
  Prisma,
  QuotationStatus
} from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { assertMoneyPrecision } from "../common/money-validation";
import {
  CalendarEventsQueryDto,
  CreateEventDto,
  EventParticipantDto,
  EventResourceDto,
  EventTaskDto,
  EventTimelineEntryDto,
  ListEventsQueryDto,
  UpdateEventDto
} from "./dto/event.dto";

type EventWithDetails = Event & {
  client?: Client | null;
  tasks?: EventTask[];
  participants?: EventParticipant[];
  resources?: EventResource[];
  timeline?: EventTimelineEntry[];
};

export interface PaginatedEvents {
  items: EventWithDetails[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EventSummary {
  total: number;
  draft: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  archived: number;
}

export interface CalendarEvent {
  id: string;
  code: string;
  name: string;
  status: EventStatus;
  startAt: Date;
  endAt: Date;
  client: { displayName: string } | null;
  venueName: string | null;
  city: string | null;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateEventDto): Promise<EventWithDetails> {
    this.assertDates(dto.startAt, dto.endAt);
    if (dto.clientId) {
      await this.ensureClient(organizationId, dto.clientId);
    }
    if (dto.quotationId) {
      await this.ensureApprovedQuotation(organizationId, dto.quotationId);
    }

    return this.prisma.$transaction(async (tx) => {
      const organization = await this.findOrganization(organizationId, tx);
      const currency = this.clean(dto.currency)?.toUpperCase() ?? organization.currency;
      if (dto.budget !== undefined) assertMoneyPrecision(dto.budget, currency);
      const code = await this.nextCode(organizationId, tx);
      const event = await tx.event.create({
        data: {
          organizationId,
          clientId: dto.clientId,
          quotationId: dto.quotationId,
          code,
          name: this.required(dto.name),
          description: this.clean(dto.description),
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          timezone: this.clean(dto.timezone) ?? organization.timezone,
          venueName: this.clean(dto.venueName),
          address: this.clean(dto.address),
          city: this.clean(dto.city),
          region: this.clean(dto.region),
          country: this.clean(dto.country)?.toUpperCase() ?? organization.country,
          contactName: this.clean(dto.contactName),
          contactEmail: this.clean(dto.contactEmail),
          contactPhone: this.clean(dto.contactPhone),
          budget: dto.budget === undefined ? undefined : new Prisma.Decimal(dto.budget),
          currency,
          notes: this.clean(dto.notes),
          createdByUserId: userId
        }
      });
      await this.audit(tx, organizationId, userId, "event.created", event.id);
      return this.findEvent(organizationId, event.id, tx, true);
    });
  }

  async createFromQuotation(organizationId: string, quotationId: string, userId: string, dto: CreateEventDto): Promise<EventWithDetails> {
    this.assertDates(dto.startAt, dto.endAt);
    return this.prisma.$transaction(async (tx) => {
      const organization = await this.findOrganization(organizationId, tx);
      const quotation = await tx.quotation.findFirst({
        where: { id: quotationId, organizationId, archivedAt: null },
        include: { items: true }
      });
      if (!quotation || quotation.status !== QuotationStatus.APPROVED) {
        throw new BadRequestException("Only approved quotations can create events");
      }
      if (dto.clientId && dto.clientId !== quotation.clientId) {
        await this.ensureClient(organizationId, dto.clientId);
      }
      const event = await tx.event.create({
        data: {
          organizationId,
          clientId: dto.clientId ?? quotation.clientId,
          quotationId,
          code: await this.nextCode(organizationId, tx),
          name: this.required(dto.name),
          description: this.clean(dto.description),
          startAt: new Date(dto.startAt),
          endAt: new Date(dto.endAt),
          timezone: this.clean(dto.timezone) ?? organization.timezone,
          venueName: this.clean(dto.venueName),
          address: this.clean(dto.address),
          city: this.clean(dto.city),
          region: this.clean(dto.region),
          country: this.clean(dto.country)?.toUpperCase() ?? organization.country,
          contactName: this.clean(dto.contactName),
          contactEmail: this.clean(dto.contactEmail),
          contactPhone: this.clean(dto.contactPhone),
          budget: quotation.total,
          currency: quotation.currency,
          notes: this.clean(dto.notes),
          createdByUserId: userId,
          resources: {
            create: quotation.items.map((item) => ({
              organizationId,
              catalogItemId: item.catalogItemId,
              name: item.name,
              quantity: item.quantity,
              unit: item.unit,
              unitCost: item.unitPrice,
              notes: item.description
            }))
          }
        }
      });
      await this.audit(tx, organizationId, userId, "event.created_from_quotation", event.id);
      return this.findEvent(organizationId, event.id, tx, true);
    });
  }

  async list(organizationId: string, query: ListEventsQueryDto): Promise<PaginatedEvents> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.event.findMany({
        where,
        include: { client: true },
        orderBy: { [query.sortBy ?? "startAt"]: query.sortDirection ?? "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.event.count({ where })
    ]);
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  async summary(organizationId: string): Promise<EventSummary> {
    const grouped = await this.prisma.event.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true }
    });
    const count = (status: EventStatus): number => {
      const item = grouped.find((group) => group.status === status);
      return typeof item?._count === "object" ? item._count._all ?? 0 : 0;
    };
    return {
      total: grouped.reduce((sum, item) => sum + (typeof item._count === "object" ? item._count._all ?? 0 : 0), 0),
      draft: count(EventStatus.DRAFT),
      confirmed: count(EventStatus.CONFIRMED),
      inProgress: count(EventStatus.IN_PROGRESS),
      completed: count(EventStatus.COMPLETED),
      cancelled: count(EventStatus.CANCELLED),
      archived: count(EventStatus.ARCHIVED)
    };
  }

  async calendar(organizationId: string, query: CalendarEventsQueryDto): Promise<CalendarEvent[]> {
    this.assertDates(query.from, query.to);
    return this.prisma.event.findMany({
      where: {
        organizationId,
        archivedAt: null,
        status: { not: EventStatus.ARCHIVED },
        startAt: { lte: new Date(query.to) },
        endAt: { gte: new Date(query.from) }
      },
      select: {
        id: true,
        code: true,
        name: true,
        status: true,
        startAt: true,
        endAt: true,
        client: { select: { displayName: true } },
        venueName: true,
        city: true
      },
      orderBy: { startAt: "asc" }
    });
  }

  async get(organizationId: string, eventId: string): Promise<EventWithDetails> {
    return this.findEvent(organizationId, eventId, this.prisma, true);
  }

  async update(organizationId: string, eventId: string, userId: string, dto: UpdateEventDto): Promise<EventWithDetails> {
    const existing = await this.findEvent(organizationId, eventId, this.prisma);
    if (existing.status === EventStatus.CANCELLED && Object.keys(dto).some((key) => key !== "notes")) {
      throw new ForbiddenException("Cancelled events can only update administrative notes");
    }
    if (existing.status === EventStatus.COMPLETED || existing.status === EventStatus.ARCHIVED) {
      throw new ForbiddenException("Completed or archived events cannot be edited");
    }
    const startAt = dto.startAt ?? existing.startAt.toISOString();
    const endAt = dto.endAt ?? existing.endAt.toISOString();
    this.assertDates(startAt, endAt);
    if (dto.clientId) {
      await this.ensureClient(organizationId, dto.clientId);
    }

    return this.prisma.$transaction(async (tx) => {
      const currency = dto.currency === undefined ? existing.currency : this.required(dto.currency).toUpperCase();
      const budget = dto.budget === undefined ? existing.budget : dto.budget;
      if (budget !== null) assertMoneyPrecision(budget.toString(), currency);
      await tx.event.update({
        where: { id: eventId },
        data: {
          clientId: dto.clientId === undefined ? undefined : dto.clientId,
          name: dto.name === undefined ? undefined : this.required(dto.name),
          description: dto.description === undefined ? undefined : this.clean(dto.description),
          startAt: dto.startAt ? new Date(dto.startAt) : undefined,
          endAt: dto.endAt ? new Date(dto.endAt) : undefined,
          timezone: dto.timezone === undefined ? undefined : this.required(dto.timezone),
          venueName: dto.venueName === undefined ? undefined : this.clean(dto.venueName),
          address: dto.address === undefined ? undefined : this.clean(dto.address),
          city: dto.city === undefined ? undefined : this.clean(dto.city),
          region: dto.region === undefined ? undefined : this.clean(dto.region),
          country: dto.country === undefined ? undefined : this.required(dto.country).toUpperCase(),
          contactName: dto.contactName === undefined ? undefined : this.clean(dto.contactName),
          contactEmail: dto.contactEmail === undefined ? undefined : this.clean(dto.contactEmail),
          contactPhone: dto.contactPhone === undefined ? undefined : this.clean(dto.contactPhone),
          budget: dto.budget === undefined ? undefined : dto.budget === null ? null : new Prisma.Decimal(dto.budget),
          currency: dto.currency === undefined ? undefined : currency,
          notes: dto.notes === undefined ? undefined : this.clean(dto.notes)
        }
      });
      await this.audit(tx, organizationId, userId, "event.updated", eventId);
      return this.findEvent(organizationId, eventId, tx, true);
    });
  }

  async archive(organizationId: string, eventId: string, userId: string): Promise<void> {
    await this.findEvent(organizationId, eventId, this.prisma);
    await this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: eventId }, data: { status: EventStatus.ARCHIVED, archivedAt: new Date() } });
      await this.audit(tx, organizationId, userId, "event.archived", eventId);
    });
  }

  confirm(organizationId: string, eventId: string, userId: string): Promise<EventWithDetails> {
    return this.changeStatus(organizationId, eventId, userId, EventStatus.CONFIRMED);
  }

  start(organizationId: string, eventId: string, userId: string): Promise<EventWithDetails> {
    return this.changeStatus(organizationId, eventId, userId, EventStatus.IN_PROGRESS);
  }

  complete(organizationId: string, eventId: string, userId: string): Promise<EventWithDetails> {
    return this.changeStatus(organizationId, eventId, userId, EventStatus.COMPLETED);
  }

  cancel(organizationId: string, eventId: string, userId: string): Promise<EventWithDetails> {
    return this.changeStatus(organizationId, eventId, userId, EventStatus.CANCELLED);
  }

  async createTask(organizationId: string, eventId: string, userId: string, dto: EventTaskDto): Promise<EventTask> {
    await this.findEvent(organizationId, eventId, this.prisma);
    if (dto.assignedUserId) {
      await this.ensureActiveMember(organizationId, dto.assignedUserId);
    }
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.eventTask.create({
        data: this.mapTask(organizationId, eventId, userId, dto)
      });
      await this.audit(tx, organizationId, userId, "event.task.created", eventId);
      return task;
    });
  }

  async listTasks(organizationId: string, eventId: string): Promise<EventTask[]> {
    await this.findEvent(organizationId, eventId, this.prisma);
    return this.prisma.eventTask.findMany({ where: { organizationId, eventId }, orderBy: { createdAt: "asc" } });
  }

  async updateTask(organizationId: string, eventId: string, taskId: string, userId: string, dto: EventTaskDto): Promise<EventTask> {
    await this.findTask(organizationId, eventId, taskId);
    if (dto.assignedUserId) {
      await this.ensureActiveMember(organizationId, dto.assignedUserId);
    }
    const task = await this.prisma.eventTask.update({
      where: { id: taskId },
      data: {
        title: this.required(dto.title),
        description: this.clean(dto.description),
        status: dto.status,
        priority: dto.priority,
        assignedUserId: dto.assignedUserId,
        dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
        completedAt: dto.status === EventTaskStatus.COMPLETED ? new Date() : null
      }
    });
    await this.prisma.organizationAuditLog.create({
      data: { organizationId, actorUserId: userId, action: "event.task.updated", targetType: "event", targetId: eventId }
    });
    return task;
  }

  async deleteTask(organizationId: string, eventId: string, taskId: string): Promise<void> {
    await this.findTask(organizationId, eventId, taskId);
    await this.prisma.eventTask.delete({ where: { id: taskId } });
  }

  async createParticipant(organizationId: string, eventId: string, dto: EventParticipantDto): Promise<EventParticipant> {
    await this.findEvent(organizationId, eventId, this.prisma);
    if (dto.userId) {
      await this.ensureActiveMember(organizationId, dto.userId);
    }
    if (dto.clientId) {
      await this.ensureClient(organizationId, dto.clientId);
    }
    if (!dto.userId && !dto.clientId && !this.clean(dto.externalName) && !this.clean(dto.externalEmail)) {
      throw new BadRequestException("Participant requires user, client, name or email");
    }
    return this.prisma.eventParticipant.create({
      data: {
        organizationId,
        eventId,
        userId: dto.userId,
        clientId: dto.clientId,
        externalName: this.clean(dto.externalName),
        externalEmail: this.clean(dto.externalEmail),
        externalPhone: this.clean(dto.externalPhone),
        role: dto.role,
        notes: this.clean(dto.notes)
      }
    });
  }

  async listParticipants(organizationId: string, eventId: string): Promise<EventParticipant[]> {
    await this.findEvent(organizationId, eventId, this.prisma);
    return this.prisma.eventParticipant.findMany({ where: { organizationId, eventId }, orderBy: { createdAt: "asc" } });
  }

  async deleteParticipant(organizationId: string, eventId: string, participantId: string): Promise<void> {
    const participant = await this.prisma.eventParticipant.findFirst({ where: { id: participantId, organizationId, eventId } });
    if (!participant) {
      throw new NotFoundException("Participant not found");
    }
    await this.prisma.eventParticipant.delete({ where: { id: participantId } });
  }

  async createResource(organizationId: string, eventId: string, dto: EventResourceDto): Promise<EventResource> {
    const event = await this.findEvent(organizationId, eventId, this.prisma);
    const catalogItem = dto.catalogItemId ? await this.ensureCatalogItem(organizationId, dto.catalogItemId) : null;
    return this.prisma.eventResource.create({
      data: this.mapResource(organizationId, eventId, dto, catalogItem, event.currency)
    });
  }

  async listResources(organizationId: string, eventId: string): Promise<EventResource[]> {
    await this.findEvent(organizationId, eventId, this.prisma);
    return this.prisma.eventResource.findMany({ where: { organizationId, eventId }, orderBy: { createdAt: "asc" } });
  }

  async updateResource(organizationId: string, eventId: string, resourceId: string, dto: EventResourceDto): Promise<EventResource> {
    const event = await this.findEvent(organizationId, eventId, this.prisma);
    await this.findResource(organizationId, eventId, resourceId);
    const catalogItem = dto.catalogItemId ? await this.ensureCatalogItem(organizationId, dto.catalogItemId) : null;
    return this.prisma.eventResource.update({ where: { id: resourceId }, data: this.mapResource(organizationId, eventId, dto, catalogItem, event.currency) });
  }

  async deleteResource(organizationId: string, eventId: string, resourceId: string): Promise<void> {
    await this.findResource(organizationId, eventId, resourceId);
    await this.prisma.eventResource.delete({ where: { id: resourceId } });
  }

  async createTimelineEntry(organizationId: string, eventId: string, dto: EventTimelineEntryDto): Promise<EventTimelineEntry> {
    await this.findEvent(organizationId, eventId, this.prisma);
    this.assertOptionalEnd(dto.startsAt, dto.endsAt);
    const sortOrder = dto.sortOrder ?? (await this.prisma.eventTimelineEntry.count({ where: { organizationId, eventId } })) + 1;
    return this.prisma.eventTimelineEntry.create({
      data: this.mapTimeline(organizationId, eventId, dto, sortOrder)
    });
  }

  async listTimeline(organizationId: string, eventId: string): Promise<EventTimelineEntry[]> {
    await this.findEvent(organizationId, eventId, this.prisma);
    return this.prisma.eventTimelineEntry.findMany({ where: { organizationId, eventId }, orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] });
  }

  async updateTimelineEntry(organizationId: string, eventId: string, entryId: string, dto: EventTimelineEntryDto): Promise<EventTimelineEntry> {
    const existing = await this.findTimelineEntry(organizationId, eventId, entryId);
    this.assertOptionalEnd(dto.startsAt, dto.endsAt);
    return this.prisma.eventTimelineEntry.update({
      where: { id: entryId },
      data: this.mapTimeline(organizationId, eventId, dto, dto.sortOrder ?? existing.sortOrder)
    });
  }

  async deleteTimelineEntry(organizationId: string, eventId: string, entryId: string): Promise<void> {
    await this.findTimelineEntry(organizationId, eventId, entryId);
    await this.prisma.eventTimelineEntry.delete({ where: { id: entryId } });
  }

  validateDateRange(startAt: string, endAt: string): void {
    this.assertDates(startAt, endAt);
  }

  validateTransition(previous: EventStatus, next: EventStatus): void {
    this.assertTransition(previous, next);
  }

  async previewNextCode(organizationId: string, tx: Prisma.TransactionClient): Promise<string> {
    return this.nextCode(organizationId, tx);
  }

  private async changeStatus(organizationId: string, eventId: string, userId: string, nextStatus: EventStatus): Promise<EventWithDetails> {
    const existing = await this.findEvent(organizationId, eventId, this.prisma);
    this.assertTransition(existing.status, nextStatus);
    return this.prisma.$transaction(async (tx) => {
      await tx.event.update({ where: { id: eventId }, data: { status: nextStatus } });
      await this.audit(tx, organizationId, userId, `event.${nextStatus.toLowerCase()}`, eventId);
      return this.findEvent(organizationId, eventId, tx, true);
    });
  }

  private assertTransition(previous: EventStatus, next: EventStatus): void {
    const allowed: Record<EventStatus, EventStatus[]> = {
      DRAFT: [EventStatus.CONFIRMED, EventStatus.CANCELLED, EventStatus.ARCHIVED],
      CONFIRMED: [EventStatus.IN_PROGRESS, EventStatus.CANCELLED, EventStatus.ARCHIVED],
      IN_PROGRESS: [EventStatus.COMPLETED, EventStatus.CANCELLED, EventStatus.ARCHIVED],
      COMPLETED: [EventStatus.ARCHIVED],
      CANCELLED: [EventStatus.ARCHIVED],
      ARCHIVED: []
    };
    if (!allowed[previous].includes(next)) {
      throw new BadRequestException("Invalid event status transition");
    }
  }

  private assertDates(startAt: string, endAt: string): void {
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      throw new BadRequestException("startAt must be before endAt");
    }
  }

  private assertOptionalEnd(startsAt: string, endsAt: string | null | undefined): void {
    if (endsAt) {
      this.assertDates(startsAt, endsAt);
    }
  }

  private buildWhere(organizationId: string, query: ListEventsQueryDto): Prisma.EventWhereInput {
    return {
      organizationId,
      ...(query.includeArchived ? {} : { archivedAt: null, status: { not: EventStatus.ARCHIVED } }),
      ...(query.status ? { status: query.status } : {}),
      ...(query.clientId ? { clientId: query.clientId } : {}),
      ...(query.quotationId ? { quotationId: query.quotationId } : {}),
      ...(query.city ? { city: { contains: query.city.trim(), mode: "insensitive" } } : {}),
      ...(query.dateFrom || query.dateTo
        ? {
            startAt: {
              ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}),
              ...(query.dateTo ? { lte: new Date(query.dateTo) } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { code: { contains: query.search.trim(), mode: "insensitive" } },
              { name: { contains: query.search.trim(), mode: "insensitive" } },
              { client: { displayName: { contains: query.search.trim(), mode: "insensitive" } } }
            ]
          }
        : {})
    };
  }

  private async ensureClient(organizationId: string, clientId: string): Promise<void> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId, archivedAt: null } });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
  }

  private async ensureApprovedQuotation(organizationId: string, quotationId: string): Promise<void> {
    const quotation = await this.prisma.quotation.findFirst({
      where: { id: quotationId, organizationId, archivedAt: null, status: QuotationStatus.APPROVED }
    });
    if (!quotation) {
      throw new BadRequestException("Quotation must be approved and belong to this organization");
    }
  }

  private async ensureCatalogItem(organizationId: string, catalogItemId: string): Promise<CatalogItem> {
    const catalogItem = await this.prisma.catalogItem.findFirst({ where: { id: catalogItemId, organizationId, archivedAt: null } });
    if (!catalogItem) {
      throw new NotFoundException("Catalog item not found");
    }
    return catalogItem;
  }

  private async ensureActiveMember(organizationId: string, userId: string): Promise<void> {
    const member = await this.prisma.organizationMembership.findFirst({ where: { organizationId, userId, status: "ACTIVE" } });
    if (!member) {
      throw new NotFoundException("Member not found");
    }
  }

  private async findOrganization(organizationId: string, tx: Prisma.TransactionClient): Promise<Organization> {
    const organization = await tx.organization.findFirst({ where: { id: organizationId, deletedAt: null } });
    if (!organization) {
      throw new NotFoundException("Organization not found");
    }
    return organization;
  }

  private async findEvent(
    organizationId: string,
    eventId: string,
    tx: Prisma.TransactionClient | PrismaService,
    includeDetails = false
  ): Promise<EventWithDetails> {
    const event = await tx.event.findFirst({
      where: { id: eventId, organizationId, archivedAt: null },
      include: includeDetails
        ? {
            client: true,
            tasks: { orderBy: { createdAt: "asc" } },
            participants: { orderBy: { createdAt: "asc" } },
            resources: { orderBy: { createdAt: "asc" } },
            timeline: { orderBy: [{ sortOrder: "asc" }, { startsAt: "asc" }] }
          }
        : undefined
    });
    if (!event) {
      throw new NotFoundException("Event not found");
    }
    return event;
  }

  private async findTask(organizationId: string, eventId: string, taskId: string): Promise<EventTask> {
    const task = await this.prisma.eventTask.findFirst({ where: { id: taskId, organizationId, eventId } });
    if (!task) {
      throw new NotFoundException("Task not found");
    }
    return task;
  }

  private async findResource(organizationId: string, eventId: string, resourceId: string): Promise<EventResource> {
    const resource = await this.prisma.eventResource.findFirst({ where: { id: resourceId, organizationId, eventId } });
    if (!resource) {
      throw new NotFoundException("Resource not found");
    }
    return resource;
  }

  private async findTimelineEntry(organizationId: string, eventId: string, entryId: string): Promise<EventTimelineEntry> {
    const entry = await this.prisma.eventTimelineEntry.findFirst({ where: { id: entryId, organizationId, eventId } });
    if (!entry) {
      throw new NotFoundException("Timeline entry not found");
    }
    return entry;
  }

  private async nextCode(organizationId: string, tx: Prisma.TransactionClient): Promise<string> {
    const latest = await tx.event.findFirst({
      where: { organizationId, code: { startsWith: "EVT-" } },
      orderBy: { code: "desc" }
    });
    const latestNumber = latest?.code.replace("EVT-", "");
    const next = latestNumber && /^\d+$/.test(latestNumber) ? Number(latestNumber) + 1 : 1;
    return `EVT-${String(next).padStart(6, "0")}`;
  }

  private mapTask(organizationId: string, eventId: string, userId: string, dto: EventTaskDto): Prisma.EventTaskUncheckedCreateInput {
    return {
      organizationId,
      eventId,
      title: this.required(dto.title),
      description: this.clean(dto.description),
      status: dto.status,
      priority: dto.priority,
      assignedUserId: dto.assignedUserId,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      completedAt: dto.status === EventTaskStatus.COMPLETED ? new Date() : null,
      createdByUserId: userId
    };
  }

  private mapResource(
    organizationId: string,
    eventId: string,
    dto: EventResourceDto,
    catalogItem: CatalogItem | null,
    currency: string
  ): Prisma.EventResourceUncheckedCreateInput {
    const unitCost = dto.unitCost === undefined ? catalogItem?.cost ?? null : dto.unitCost === null ? null : new Prisma.Decimal(dto.unitCost);
    if (unitCost !== null) assertMoneyPrecision(unitCost.toString(), currency);
    return {
      organizationId,
      eventId,
      catalogItemId: catalogItem?.id ?? dto.catalogItemId,
      name: this.required(catalogItem?.name ?? dto.name),
      quantity: new Prisma.Decimal(dto.quantity),
      unit: this.required(catalogItem?.unit ?? dto.unit),
      unitCost,
      notes: this.clean(dto.notes)
    };
  }

  private mapTimeline(
    organizationId: string,
    eventId: string,
    dto: EventTimelineEntryDto,
    sortOrder: number
  ): Prisma.EventTimelineEntryUncheckedCreateInput {
    return {
      organizationId,
      eventId,
      title: this.required(dto.title),
      description: this.clean(dto.description),
      startsAt: new Date(dto.startsAt),
      endsAt: dto.endsAt ? new Date(dto.endsAt) : null,
      sortOrder
    };
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string
  ): Promise<unknown> {
    return tx.organizationAuditLog.create({
      data: { organizationId, actorUserId, action, targetType: "event", targetId }
    });
  }

  private required(value: string): string {
    const cleaned = this.clean(value);
    if (!cleaned) {
      throw new BadRequestException("Required field cannot be empty");
    }
    return cleaned;
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }
}
