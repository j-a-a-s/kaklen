import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import {
  CatalogItemStatus,
  CatalogItemType,
  ClientInteractionType,
  ClientType,
  EventStatus,
  EventTaskPriority,
  EventTaskStatus,
  QuotationItemType,
  QuotationStatus
} from "@prisma/client";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto } from "../catalog/dto/catalog.dto";
import { CreateClientDto, CreateClientInteractionDto, ListClientsQueryDto, UpdateClientDto } from "../clients/dto/client.dto";
import {
  CalendarEventsQueryDto,
  CreateEventDto,
  EventParticipantDto,
  EventResourceDto,
  EventTaskDto,
  EventTimelineEntryDto,
  ListEventsQueryDto,
  UpdateEventDto
} from "../events/dto/event.dto";
import { CreateOrganizationDto, InviteMemberDto, UpdateMembershipDto, UpdateOrganizationDto } from "../organizations/dto/organization.dto";
import {
  ChangeQuotationStatusDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  QuotationItemInputDto,
  UpdateQuotationDto
} from "../quotations/dto/quotation.dto";

describe("DTO validation", () => {
  it("validates catalog create, update, and query payloads", async () => {
    await expectValid(
      CreateCatalogItemDto,
      { type: CatalogItemType.PRODUCT, code: "P-1", name: "Speaker", unit: "unit", cost: "10", price: "20", taxPercent: "19", currency: "CLP" }
    );
    await expectInvalid(CreateCatalogItemDto, { type: "OTHER", code: "", name: "x", unit: "u", cost: -1, price: 1, taxPercent: 101, currency: "CLP" });
    await expectValid(UpdateCatalogItemDto, { status: CatalogItemStatus.INACTIVE, price: "0", taxPercent: "0" });
    await expectInvalid(ListCatalogItemsQueryDto, { page: "0", pageSize: "101", minPrice: "-1", includeArchived: "maybe" });
  });

  it("validates client DTOs with RUT and conditional person/company fields", async () => {
    await expectValid(CreateClientDto, { type: ClientType.NATURAL_PERSON, firstName: "Ada", lastName: "Lovelace", country: "CL", taxId: "12345678-5" });
    await expectInvalid(CreateClientDto, { type: ClientType.NATURAL_PERSON, country: "CL", taxId: "bad-rut" });
    await expectInvalid(CreateClientDto, { type: ClientType.LEGAL_ENTITY, firstName: "Wrong", country: "CL" });
    await expectValid(UpdateClientDto, { type: ClientType.LEGAL_ENTITY, legalName: "ACME", taxId: "bad-rut", country: "US" });
    await expectInvalid(ListClientsQueryDto, { page: "0", pageSize: "101", includeArchived: "not-bool" });
    await expectValid(CreateClientInteractionDto, { type: ClientInteractionType.NOTE, description: "Follow up", occurredAt: "2026-08-01T10:00:00.000Z" });
  });

  it("validates event DTOs, timeline dates, paging, and enums", async () => {
    await expectValid(CreateEventDto, {
      name: "Gala",
      startAt: "2026-08-01T10:00:00.000Z",
      endAt: "2026-08-01T12:00:00.000Z",
      budget: "1000",
      currency: "CLP",
      contactEmail: "guest@example.com"
    });
    await expectInvalid(CreateEventDto, { name: "Gala", startAt: "not-date", endAt: "2026-08-01T12:00:00.000Z", contactEmail: "bad" });
    await expectValid(UpdateEventDto, { name: "Gala final", budget: "0", contactEmail: "guest@example.com" });
    await expectInvalid(ListEventsQueryDto, { status: "BROKEN", includeArchived: "true", page: "0", pageSize: "101", sortBy: "bad" });
    await expectValid(ListEventsQueryDto, { status: EventStatus.CONFIRMED, includeArchived: "true", page: "1", pageSize: "20", sortBy: "name" });
    await expectValid(CalendarEventsQueryDto, { from: "2026-08-01T00:00:00.000Z", to: "2026-08-31T23:59:59.000Z" });
    await expectValid(EventTaskDto, { title: "Task", status: EventTaskStatus.PENDING, priority: EventTaskPriority.HIGH });
    await expectInvalid(EventTaskDto, { title: "Task", status: "BROKEN", priority: "NOPE" });
    await expectValid(EventParticipantDto, { role: "GUEST", externalEmail: "guest@example.com" });
    await expectInvalid(EventParticipantDto, { role: "GUEST", externalEmail: "not-email" });
    await expectValid(EventResourceDto, { name: "Speaker", quantity: "2", unit: "unit", unitCost: "10" });
    await expectInvalid(EventResourceDto, { name: "Speaker", quantity: "0", unit: "unit" });
    await expectValid(EventTimelineEntryDto, { title: "Open", startsAt: "2026-08-01T10:00:00.000Z", sortOrder: "1" });
    await expectInvalid(EventTimelineEntryDto, { title: "Open", startsAt: "bad-date", sortOrder: "0" });
  });

  it("validates organization and membership DTOs", async () => {
    await expectValid(CreateOrganizationDto, { name: "Kaklen", country: "CL", taxId: "12345678-5", dateFormat: "dd-MM-yyyy", numberFormat: "es" });
    await expectInvalid(CreateOrganizationDto, { name: "K", country: "CL", taxId: "bad-rut", dateFormat: "bad", numberFormat: "bad" });
    await expectValid(UpdateOrganizationDto, { name: "Kaklen Pro", country: "US", taxId: "not-a-rut" });
    await expectValid(InviteMemberDto, { email: "member@example.com", role: "MEMBER" });
    await expectInvalid(InviteMemberDto, { email: "bad-email", role: "NOPE" });
    await expectValid(UpdateMembershipDto, { role: "MANAGER", status: "ACTIVE" });
    await expectInvalid(UpdateMembershipDto, { role: "NOPE", status: "MISSING" });
  });

  it("validates quotation DTOs and nested item constraints", async () => {
    await expectValid(QuotationItemInputDto, { type: QuotationItemType.CUSTOM, name: "Item", quantity: "1", unit: "unit", unitPrice: "100", taxPercent: "19" });
    await expectInvalid(QuotationItemInputDto, { type: "BROKEN", name: "Item", quantity: "0", unit: "unit", unitPrice: "-1", taxPercent: "101" });
    await expectValid(CreateQuotationDto, {
      clientId: "00000000-0000-4000-8000-000000000001",
      issueDate: "2026-08-01",
      validUntil: "2026-08-31",
      items: [{ type: QuotationItemType.CUSTOM, name: "Item", quantity: "1", unit: "unit", unitPrice: "100", taxPercent: "19" }]
    });
    await expectInvalid(CreateQuotationDto, { clientId: "bad", issueDate: "bad-date", validUntil: "2026-08-31", items: [] });
    await expectValid(UpdateQuotationDto, {
      currency: "CLP",
      items: [{ type: QuotationItemType.CUSTOM, name: "Item", quantity: "1", unit: "unit", unitPrice: "100", taxPercent: "19" }]
    });
    await expectInvalid(ListQuotationsQueryDto, { status: "BROKEN", page: "0", pageSize: "101", sortBy: "bad", sortDirection: "sideways" });
    await expectValid(ListQuotationsQueryDto, { status: QuotationStatus.SENT, page: "1", pageSize: "20", sortBy: "total", sortDirection: "asc" });
    await expectValid(ChangeQuotationStatusDto, { note: "Approved" });
  });
});

async function expectValid<T extends object>(ctor: new () => T, payload: Record<string, unknown>): Promise<void> {
  await expect(validate(plainToInstance(ctor, payload))).resolves.toHaveLength(0);
}

async function expectInvalid<T extends object>(ctor: new () => T, payload: Record<string, unknown>): Promise<void> {
  const errors = await validate(plainToInstance(ctor, payload));
  expect(errors.length).toBeGreaterThan(0);
}
