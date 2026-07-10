import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { CatalogItem, CatalogItemStatus, CatalogItemType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto } from "./dto/catalog.dto";

interface CatalogInput {
  type: CatalogItemType;
  status?: CatalogItemStatus;
  sku?: string | null;
  code: string;
  name: string;
  description?: string | null;
  unit: string;
  cost: number | Prisma.Decimal;
  price: number | Prisma.Decimal;
  taxPercent: number | Prisma.Decimal;
  currency: string;
}

interface CatalogWritableData {
  type: CatalogItemType;
  status: CatalogItemStatus;
  sku: string | null;
  code: string;
  name: string;
  description: string | null;
  unit: string;
  cost: Prisma.Decimal;
  price: Prisma.Decimal;
  taxPercent: Prisma.Decimal;
  currency: string;
  trackInventory: boolean;
}

export interface PaginatedCatalogItems {
  items: CatalogItem[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async create(organizationId: string, userId: string, dto: CreateCatalogItemDto): Promise<CatalogItem> {
    const data = this.mapCatalogInput(dto);
    await this.ensureCodeAvailable(organizationId, data.code);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogItem.create({
          data: {
            ...data,
            organizationId,
            createdByUserId: userId
          }
        });
        await this.audit(tx, organizationId, userId, "catalog_item.created", item.id);
        return item;
      });
    } catch (error) {
      this.throwConflictForDuplicateCode(error);
      throw error;
    }
  }

  async list(
    organizationId: string,
    query: ListCatalogItemsQueryDto
  ): Promise<PaginatedCatalogItems> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const where = this.buildWhere(organizationId, query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.catalogItem.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize
      }),
      this.prisma.catalogItem.count({ where })
    ]);

    return {
      items,
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  async get(organizationId: string, itemId: string): Promise<CatalogItem> {
    return this.findItem(organizationId, itemId);
  }

  async update(
    organizationId: string,
    itemId: string,
    userId: string,
    dto: UpdateCatalogItemDto
  ): Promise<CatalogItem> {
    const existing = await this.findItem(organizationId, itemId);
    const data = this.mapCatalogInput({
      type: dto.type ?? existing.type,
      status: dto.status ?? existing.status,
      sku: dto.sku === undefined ? existing.sku : dto.sku,
      code: dto.code === undefined ? existing.code : dto.code,
      name: dto.name === undefined ? existing.name : dto.name,
      description: dto.description === undefined ? existing.description : dto.description,
      unit: dto.unit === undefined ? existing.unit : dto.unit,
      cost: dto.cost === undefined ? existing.cost : dto.cost,
      price: dto.price === undefined ? existing.price : dto.price,
      taxPercent: dto.taxPercent === undefined ? existing.taxPercent : dto.taxPercent,
      currency: dto.currency === undefined ? existing.currency : dto.currency
    });
    await this.ensureCodeAvailable(organizationId, data.code, itemId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const item = await tx.catalogItem.update({
          where: { id: itemId },
          data
        });
        await this.audit(tx, organizationId, userId, "catalog_item.updated", itemId);
        return item;
      });
    } catch (error) {
      this.throwConflictForDuplicateCode(error);
      throw error;
    }
  }

  async archive(organizationId: string, itemId: string, userId: string): Promise<void> {
    await this.findItem(organizationId, itemId);
    await this.prisma.$transaction(async (tx) => {
      await tx.catalogItem.update({
        where: { id: itemId },
        data: { status: CatalogItemStatus.ARCHIVED, archivedAt: new Date() }
      });
      await this.audit(tx, organizationId, userId, "catalog_item.archived", itemId);
    });
  }

  mapCatalogInput(dto: CatalogInput): CatalogWritableData {
    const code = this.clean(dto.code)?.toUpperCase();
    const name = this.clean(dto.name);
    const unit = this.clean(dto.unit);
    const currency = this.clean(dto.currency)?.toUpperCase();

    if (!code) {
      throw new BadRequestException("Catalog item code is required");
    }
    if (!name) {
      throw new BadRequestException("Catalog item name is required");
    }
    if (!unit) {
      throw new BadRequestException("Catalog item unit is required");
    }
    if (!currency) {
      throw new BadRequestException("Catalog item currency is required");
    }

    const cost = this.toDecimal(dto.cost);
    const price = this.toDecimal(dto.price);
    const taxPercent = this.toDecimal(dto.taxPercent);

    if (cost.isNegative() || price.isNegative() || taxPercent.isNegative()) {
      throw new BadRequestException("Catalog monetary values must be non-negative");
    }

    return {
      type: dto.type,
      status: dto.status ?? CatalogItemStatus.ACTIVE,
      sku: this.clean(dto.sku)?.toUpperCase() ?? null,
      code,
      name,
      description: this.clean(dto.description),
      unit,
      cost,
      price,
      taxPercent,
      currency,
      trackInventory: dto.type === CatalogItemType.PRODUCT
    };
  }

  private buildWhere(organizationId: string, query: ListCatalogItemsQueryDto): Prisma.CatalogItemWhereInput {
    const includeArchived = query.includeArchived === "true";
    return {
      organizationId,
      ...(includeArchived ? {} : { status: { not: CatalogItemStatus.ARCHIVED } }),
      ...(query.type ? { type: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.sku ? { sku: { contains: query.sku.trim(), mode: "insensitive" } } : {}),
      ...(query.code ? { code: { contains: query.code.trim(), mode: "insensitive" } } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            price: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {})
            }
          }
        : {}),
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: "insensitive" } },
              { description: { contains: query.search.trim(), mode: "insensitive" } },
              { code: { contains: query.search.trim(), mode: "insensitive" } },
              { sku: { contains: query.search.trim(), mode: "insensitive" } }
            ]
          }
        : {})
    };
  }

  private async findItem(organizationId: string, itemId: string): Promise<CatalogItem> {
    const item = await this.prisma.catalogItem.findFirst({
      where: { id: itemId, organizationId }
    });
    if (!item) {
      throw new NotFoundException("Catalog item not found");
    }
    return item;
  }

  private async ensureCodeAvailable(
    organizationId: string,
    code: string,
    exceptItemId?: string
  ): Promise<void> {
    const existing = await this.prisma.catalogItem.findFirst({
      where: { organizationId, code, ...(exceptItemId ? { id: { not: exceptItemId } } : {}) }
    });
    if (existing) {
      throw new ConflictException("Catalog item code already exists in this organization");
    }
  }

  private clean(value: string | null | undefined): string | null {
    const cleaned = value?.trim();
    return cleaned ? cleaned : null;
  }

  private toDecimal(value: number | Prisma.Decimal): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value);
  }

  private throwConflictForDuplicateCode(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new ConflictException("Catalog item code already exists in this organization");
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    organizationId: string,
    actorUserId: string,
    action: string,
    targetId: string
  ): Promise<unknown> {
    return tx.organizationAuditLog.create({
      data: { organizationId, actorUserId, action, targetType: "catalog_item", targetId }
    });
  }
}
