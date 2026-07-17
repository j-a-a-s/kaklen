import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Client, ClientInteraction, ClientStatus, ClientType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { isValidChileanRut, normalizeChileanRut } from "../common/validation/chilean-rut";
import {
  countryBusinessPolicy,
  isValidCountryPhone,
  normalizeInternationalPhone
} from "@kaklen/shared";
import { CreateClientDto, CreateClientInteractionDto, ListClientsQueryDto, UpdateClientDto } from "./dto/client.dto";

interface ClientInput {
  type: ClientType;
  status?: ClientStatus;
  firstName?: string | null;
  lastName?: string | null;
  legalName?: string | null;
  taxId?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  country?: string | null;
  region?: string | null;
  city?: string | null;
  address?: string | null;
  notes?: string | null;
}

interface ClientWritableData {
  type: ClientType;
  status: ClientStatus;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string;
  region: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ClientSummary {
  total: number;
  leads: number;
  active: number;
  inactive: number;
  archived: number;
}

@Injectable()
export class ClientsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateClientDto): Promise<Client> {
    const data = this.mapClientInput(dto);
    await this.ensureTaxIdAvailable(organizationId, data.taxId);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.create({
        data: {
          ...data,
          organizationId,
          createdByUserId: userId
        }
      });
      await this.audit(tx, organizationId, userId, "client.created", client.id);
      return client;
    });
  }

  async list(
    organizationId: string,
    query: ListClientsQueryDto
  ): Promise<PaginatedResponse<Client>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.client.findMany({
        where,
        orderBy: { displayName: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.client.count({ where })
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async get(organizationId: string, clientId: string): Promise<Client> {
    return this.findClient(organizationId, clientId);
  }

  async update(
    organizationId: string,
    clientId: string,
    userId: string,
    dto: UpdateClientDto
  ): Promise<Client> {
    const existing = await this.findClient(organizationId, clientId);
    const data = this.mapClientInput({
      type: dto.type ?? existing.type,
      status: dto.status ?? existing.status,
      firstName: dto.firstName === undefined ? existing.firstName : dto.firstName,
      lastName: dto.lastName === undefined ? existing.lastName : dto.lastName,
      legalName: dto.legalName === undefined ? existing.legalName : dto.legalName,
      taxId: dto.taxId === undefined ? existing.taxId : dto.taxId,
      email: dto.email === undefined ? existing.email : dto.email,
      phone: dto.phone === undefined ? existing.phone : dto.phone,
      whatsapp: dto.whatsapp === undefined ? existing.whatsapp : dto.whatsapp,
      country: dto.country === undefined ? existing.country : dto.country,
      region: dto.region === undefined ? existing.region : dto.region,
      city: dto.city === undefined ? existing.city : dto.city,
      address: dto.address === undefined ? existing.address : dto.address,
      notes: dto.notes === undefined ? existing.notes : dto.notes
    });
    await this.ensureTaxIdAvailable(organizationId, data.taxId, clientId);

    return this.prisma.$transaction(async (tx) => {
      const client = await tx.client.update({
        where: { id: clientId },
        data
      });
      await this.audit(tx, organizationId, userId, "client.updated", clientId);
      return client;
    });
  }

  async archive(organizationId: string, clientId: string, userId: string): Promise<void> {
    await this.findClient(organizationId, clientId);
    await this.prisma.$transaction(async (tx) => {
      await tx.client.update({
        where: { id: clientId },
        data: { status: ClientStatus.ARCHIVED, archivedAt: new Date() }
      });
      await this.audit(tx, organizationId, userId, "client.archived", clientId);
    });
  }

  async summary(organizationId: string): Promise<ClientSummary> {
    const grouped = await this.prisma.client.groupBy({
      by: ["status"],
      where: { organizationId },
      _count: { _all: true }
    });
    const count = (status: ClientStatus): number =>
      grouped.find((item) => item.status === status)?._count._all ?? 0;

    return {
      total: grouped.reduce((sum, item) => sum + item._count._all, 0),
      leads: count(ClientStatus.LEAD),
      active: count(ClientStatus.ACTIVE),
      inactive: count(ClientStatus.INACTIVE),
      archived: count(ClientStatus.ARCHIVED)
    };
  }

  async createInteraction(
    organizationId: string,
    clientId: string,
    userId: string,
    dto: CreateClientInteractionDto
  ): Promise<ClientInteraction> {
    await this.findClient(organizationId, clientId);
    return this.prisma.clientInteraction.create({
      data: {
        organizationId,
        clientId,
        userId,
        type: dto.type,
        subject: this.clean(dto.subject),
        description: dto.description.trim(),
        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : new Date()
      }
    });
  }

  async interactions(organizationId: string, clientId: string): Promise<ClientInteraction[]> {
    await this.findClient(organizationId, clientId);
    return this.prisma.clientInteraction.findMany({
      where: { organizationId, clientId },
      orderBy: { occurredAt: "desc" }
    });
  }

  mapClientInput(dto: ClientInput): ClientWritableData {
    const type = dto.type;
    const firstName = this.clean(dto.firstName);
    const lastName = this.clean(dto.lastName);
    const legalName = this.clean(dto.legalName);
    const country = this.clean(dto.country) ?? "CL";
    const policy = countryBusinessPolicy(country);

    if (type === ClientType.NATURAL_PERSON && (!firstName || !lastName)) {
      throw new BadRequestException("Persona natural requiere nombre y apellido");
    }

    if (type === ClientType.LEGAL_ENTITY && !legalName) {
      throw new BadRequestException("Persona juridica requiere razon social");
    }

    if (policy.taxIdRequired && !this.clean(dto.taxId)) {
      throw new BadRequestException({ code: "RUT_REQUIRED", message: "Chilean clients require a RUT" });
    }
    if (policy.whatsappRequired && !this.clean(dto.whatsapp)) {
      throw new BadRequestException({ code: "WHATSAPP_REQUIRED", message: "Chilean clients require WhatsApp" });
    }
    if (policy.country === "CL" && this.clean(dto.taxId) && !isValidChileanRut(this.clean(dto.taxId) ?? "")) {
      throw new BadRequestException({ code: "RUT_INVALID", message: "RUT is invalid" });
    }
    if (this.clean(dto.whatsapp) && !isValidCountryPhone(dto.whatsapp, policy.country)) {
      throw new BadRequestException({ code: "WHATSAPP_INVALID", message: "WhatsApp number is invalid" });
    }
    if (this.clean(dto.phone) && !isValidCountryPhone(dto.phone, policy.country)) {
      throw new BadRequestException({ code: "PHONE_INVALID", message: "Phone number is invalid" });
    }

    return {
      type,
      status: dto.status ?? ClientStatus.LEAD,
      displayName:
        type === ClientType.NATURAL_PERSON ? `${firstName} ${lastName}`.trim() : legalName ?? "",
      firstName: type === ClientType.NATURAL_PERSON ? firstName : null,
      lastName: type === ClientType.NATURAL_PERSON ? lastName : null,
      legalName: type === ClientType.LEGAL_ENTITY ? legalName : null,
      taxId: this.cleanTaxId(dto.taxId),
      email: this.clean(dto.email)?.toLowerCase() ?? null,
      phone: this.cleanPhone(dto.phone),
      whatsapp: this.cleanPhone(dto.whatsapp),
      country: policy.country,
      region: this.clean(dto.region),
      city: this.clean(dto.city),
      address: this.clean(dto.address),
      notes: this.clean(dto.notes)
    };
  }

  private buildWhere(organizationId: string, query: ListClientsQueryDto): Prisma.ClientWhereInput {
    const includeArchived = query.includeArchived === "true";
    return {
      organizationId,
      ...(includeArchived ? {} : { status: { not: ClientStatus.ARCHIVED } }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.city ? { city: { contains: query.city.trim(), mode: "insensitive" } } : {}),
      ...(query.search
        ? {
            OR: [
              { displayName: { contains: query.search.trim(), mode: "insensitive" } },
              { email: { contains: query.search.trim().toLowerCase(), mode: "insensitive" } },
              { taxId: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private async findClient(organizationId: string, clientId: string): Promise<Client> {
    const client = await this.prisma.client.findFirst({ where: { id: clientId, organizationId } });
    if (!client) {
      throw new NotFoundException("Client not found");
    }
    return client;
  }

  private async ensureTaxIdAvailable(
    organizationId: string,
    taxId: string | null | undefined,
    exceptClientId?: string
  ): Promise<void> {
    if (!taxId) {
      return;
    }
    const existing = await this.prisma.client.findFirst({
      where: { organizationId, taxId, ...(exceptClientId ? { id: { not: exceptClientId } } : {}) }
    });
    if (existing) {
      throw new ConflictException({
        code: "DUPLICATE_TAX_ID",
        message: "taxId already exists in this organization"
      });
    }
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private cleanTaxId(value: string | null | undefined): string | null {
    const cleaned = this.clean(value);
    if (!cleaned) {
      return null;
    }
    return isValidChileanRut(cleaned) ? normalizeChileanRut(cleaned) : cleaned;
  }

  private cleanPhone(value: string | null | undefined): string | null {
    const normalized = normalizeInternationalPhone(value);
    return normalized || null;
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string
  ): Promise<unknown> {
    return tx.organizationAuditLog.create({
      data: { organizationId, actorUserId, action, targetType: "client", targetId }
    });
  }
}
