import { ConflictException, NotFoundException } from "@nestjs/common";
import { CatalogItem, CatalogItemStatus, CatalogItemType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CatalogService } from "./catalog.service";

class FakePrismaService {
  private items: CatalogItem[] = [];

  readonly catalogItem = {
    create: async ({ data }: { data: Prisma.CatalogItemUncheckedCreateInput }): Promise<CatalogItem> => {
      const now = new Date();
      const item: CatalogItem = {
        id: `item-${this.items.length + 1}`,
        organizationId: data.organizationId,
        type: data.type,
        status: data.status ?? CatalogItemStatus.ACTIVE,
        sku: data.sku ?? null,
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        unit: data.unit,
        cost: this.toDecimal(data.cost),
        price: this.toDecimal(data.price),
        taxPercent: this.toDecimal(data.taxPercent),
        currency: data.currency,
        trackInventory: data.trackInventory,
        createdByUserId: data.createdByUserId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      this.items.push(item);
      return item;
    },
    findFirst: async ({ where }: { where: Prisma.CatalogItemWhereInput }): Promise<CatalogItem | null> => {
      return this.items.find((item) => this.matchesWhere(item, where)) ?? null;
    },
    findMany: async ({
      where,
      skip,
      take
    }: {
      where: Prisma.CatalogItemWhereInput;
      skip: number;
      take: number;
    }): Promise<CatalogItem[]> => {
      return this.items
        .filter((item) => this.matchesWhere(item, where))
        .sort((left, right) => left.name.localeCompare(right.name))
        .slice(skip, skip + take);
    },
    count: async ({ where }: { where: Prisma.CatalogItemWhereInput }): Promise<number> => {
      return this.items.filter((item) => this.matchesWhere(item, where)).length;
    },
    update: async ({
      where,
      data
    }: {
      where: Prisma.CatalogItemWhereUniqueInput;
      data: Prisma.CatalogItemUncheckedUpdateInput;
    }): Promise<CatalogItem> => {
      const item = this.items.find((current) => current.id === where.id);
      if (!item) {
        throw new Error("Catalog item not found");
      }
      Object.assign(item, data, { updatedAt: new Date() });
      return item;
    }
  };

  readonly organizationAuditLog = {
    create: async (): Promise<{ id: string }> => ({ id: "audit-1" })
  };

  async $transaction<T>(input: Promise<T>[]): Promise<T[]>;
  async $transaction<T>(input: (tx: FakePrismaService) => Promise<T>): Promise<T>;
  async $transaction<T>(input: Promise<T>[] | ((tx: FakePrismaService) => Promise<T>)): Promise<T[] | T> {
    if (Array.isArray(input)) {
      return Promise.all(input);
    }
    return input(this);
  }

  private matchesWhere(item: CatalogItem, where: Prisma.CatalogItemWhereInput): boolean {
    const idMatches = this.matchesId(item, where.id);
    const organizationMatches = !where.organizationId || where.organizationId === item.organizationId;
    const statusMatches = this.matchesStatus(item, where.status);
    const typeMatches = !where.type || where.type === item.type;
    const codeMatches = this.matchesContains(item.code, where.code);
    const skuMatches = this.matchesContains(item.sku, where.sku);
    const nameMatches = this.matchesContains(item.name, where.name);
    const descriptionMatches = this.matchesContains(item.description, where.description);
    const priceMatches = this.matchesPrice(item, where.price);
    const orMatches = !where.OR || where.OR.some((condition) => this.matchesWhere(item, condition));

    return (
      idMatches &&
      organizationMatches &&
      statusMatches &&
      typeMatches &&
      codeMatches &&
      skuMatches &&
      nameMatches &&
      descriptionMatches &&
      priceMatches &&
      orMatches
    );
  }

  private matchesId(item: CatalogItem, id: Prisma.StringFilter<"CatalogItem"> | string | undefined): boolean {
    if (!id) {
      return true;
    }
    if (typeof id === "string") {
      return item.id === id;
    }
    if (id.not && typeof id.not === "string") {
      return item.id !== id.not;
    }
    return true;
  }

  private matchesStatus(
    item: CatalogItem,
    status: Prisma.EnumCatalogItemStatusFilter<"CatalogItem"> | CatalogItemStatus | undefined
  ): boolean {
    if (!status) {
      return true;
    }
    if (typeof status === "string") {
      return item.status === status;
    }
    return status.not ? item.status !== status.not : true;
  }

  private matchesContains(
    value: string | null,
    filter: Prisma.StringNullableFilter<"CatalogItem"> | Prisma.StringFilter<"CatalogItem"> | string | null | undefined
  ): boolean {
    if (!filter) {
      return true;
    }
    if (typeof filter === "string") {
      return value === filter;
    }
    if (typeof filter.contains === "string") {
      return (value ?? "").toLowerCase().includes(filter.contains.toLowerCase());
    }
    return true;
  }

  private matchesPrice(
    item: CatalogItem,
    price: Prisma.DecimalFilter<"CatalogItem"> | Prisma.Decimal | Prisma.DecimalJsLike | number | string | undefined
  ): boolean {
    if (
      !price ||
      price instanceof Prisma.Decimal ||
      typeof price === "number" ||
      typeof price === "string" ||
      this.isDecimalJsLike(price)
    ) {
      return true;
    }
    const currentPrice = item.price.toNumber();
    const gte = price.gte instanceof Prisma.Decimal ? price.gte.toNumber() : Number(price.gte);
    const lte = price.lte instanceof Prisma.Decimal ? price.lte.toNumber() : Number(price.lte);
    return (price.gte === undefined || currentPrice >= gte) && (price.lte === undefined || currentPrice <= lte);
  }

  private toDecimal(value: Prisma.Decimal | Prisma.DecimalJsLike | number | string): Prisma.Decimal {
    return value instanceof Prisma.Decimal ? value : new Prisma.Decimal(value.toString());
  }

  private isDecimalJsLike(value: unknown): value is Prisma.DecimalJsLike {
    return typeof value === "object" && value !== null && "d" in value && "e" in value && "s" in value;
  }
}

describe("CatalogService", () => {
  let service: CatalogService;

  beforeEach(() => {
    service = new CatalogService(new FakePrismaService() as unknown as PrismaService);
  });

  it("creates products with inventory tracking enabled", async () => {
    const item = await service.create("org-a", "user-1", {
      type: CatalogItemType.PRODUCT,
      code: " prod-1 ",
      name: " Notebook ",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "clp"
    });

    expect(item.code).toBe("PROD-1");
    expect(item.trackInventory).toBe(true);
    expect(item.currency).toBe("CLP");
  });

  it("creates services with inventory tracking disabled", async () => {
    const item = await service.create("org-a", "user-1", {
      type: CatalogItemType.SERVICE,
      code: "svc-1",
      name: "Consultoria",
      unit: "hora",
      cost: 0,
      price: 75,
      taxPercent: 19,
      currency: "USD"
    });

    expect(item.trackInventory).toBe(false);
  });

  it("rejects duplicate code inside the same organization", async () => {
    const payload = {
      type: CatalogItemType.PRODUCT,
      code: "prod-1",
      name: "Notebook",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "CLP"
    };
    await service.create("org-a", "user-1", payload);

    await expect(service.create("org-a", "user-1", payload)).rejects.toBeInstanceOf(ConflictException);
  });

  it("allows the same code in another organization and isolates detail reads", async () => {
    await service.create("org-a", "user-1", {
      type: CatalogItemType.PRODUCT,
      code: "prod-1",
      name: "Notebook",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "CLP"
    });
    const otherOrgItem = await service.create("org-b", "user-1", {
      type: CatalogItemType.PRODUCT,
      code: "prod-1",
      name: "Notebook",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "CLP"
    });

    await expect(service.get("org-a", otherOrgItem.id)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists with filters and pagination", async () => {
    await service.create("org-a", "user-1", {
      type: CatalogItemType.PRODUCT,
      sku: "sku-1",
      code: "prod-1",
      name: "Notebook",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "CLP"
    });
    await service.create("org-a", "user-1", {
      type: CatalogItemType.SERVICE,
      code: "svc-1",
      name: "Consultoria",
      unit: "hora",
      cost: 0,
      price: 75,
      taxPercent: 19,
      currency: "CLP"
    });

    const page = await service.list("org-a", {
      search: "note",
      type: CatalogItemType.PRODUCT,
      minPrice: 100,
      maxPrice: 200,
      page: 1,
      pageSize: 20
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.code).toBe("PROD-1");
  });

  it("updates and archives without physical delete", async () => {
    const item = await service.create("org-a", "user-1", {
      type: CatalogItemType.PRODUCT,
      code: "prod-1",
      name: "Notebook",
      unit: "unidad",
      cost: 100,
      price: 150,
      taxPercent: 19,
      currency: "CLP"
    });

    const updated = await service.update("org-a", item.id, "user-1", { price: 175 });
    await service.archive("org-a", item.id, "user-1");
    const defaultList = await service.list("org-a", { page: 1, pageSize: 20 });
    const archivedList = await service.list("org-a", { page: 1, pageSize: 20, includeArchived: "true" });

    expect(updated.price.toNumber()).toBe(175);
    expect(defaultList.total).toBe(0);
    expect(archivedList.items[0]?.status).toBe(CatalogItemStatus.ARCHIVED);
    expect(archivedList.items[0]?.archivedAt).toBeInstanceOf(Date);
  });
});
