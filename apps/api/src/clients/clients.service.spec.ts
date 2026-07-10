import { BadRequestException } from "@nestjs/common";
import { Client, ClientStatus, ClientType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClientsService } from "./clients.service";

class FakePrismaService {
  private clients: Client[] = [];

  readonly client = {
    create: async ({ data }: { data: Prisma.ClientUncheckedCreateInput }): Promise<Client> => {
      const now = new Date();
      const client: Client = {
        id: `client-${this.clients.length + 1}`,
        organizationId: data.organizationId,
        type: data.type,
        status: data.status ?? ClientStatus.LEAD,
        displayName: data.displayName,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        legalName: data.legalName ?? null,
        taxId: data.taxId ?? null,
        email: data.email ?? null,
        phone: data.phone ?? null,
        whatsapp: data.whatsapp ?? null,
        country: data.country ?? "CL",
        region: data.region ?? null,
        city: data.city ?? null,
        address: data.address ?? null,
        notes: data.notes ?? null,
        createdByUserId: data.createdByUserId,
        createdAt: now,
        updatedAt: now,
        archivedAt: null
      };
      this.clients.push(client);
      return client;
    },
    findFirst: async ({ where }: { where: Prisma.ClientWhereInput }): Promise<Client | null> => {
      return this.clients.find((client) => this.matchesWhere(client, where)) ?? null;
    },
    findMany: async ({
      where,
      skip,
      take
    }: {
      where: Prisma.ClientWhereInput;
      skip: number;
      take: number;
    }): Promise<Client[]> => {
      return this.clients
        .filter((client) => this.matchesWhere(client, where))
        .sort((left, right) => left.displayName.localeCompare(right.displayName))
        .slice(skip, skip + take);
    },
    count: async ({ where }: { where: Prisma.ClientWhereInput }): Promise<number> => {
      return this.clients.filter((client) => this.matchesWhere(client, where)).length;
    },
    update: async ({
      where,
      data
    }: {
      where: Prisma.ClientWhereUniqueInput;
      data: Prisma.ClientUncheckedUpdateInput;
    }): Promise<Client> => {
      const client = this.clients.find((item) => item.id === where.id);
      if (!client) {
        throw new Error("Client not found");
      }
      Object.assign(client, data, { updatedAt: new Date() });
      return client;
    },
    groupBy: async (): Promise<Array<{ status: ClientStatus; _count: { _all: number } }>> => {
      return Object.values(ClientStatus).map((status) => ({
        status,
        _count: { _all: this.clients.filter((client) => client.status === status).length }
      }));
    }
  };

  readonly clientInteraction = {
    create: async (): Promise<never> => {
      throw new Error("Not needed in this spec");
    },
    findMany: async (): Promise<never> => {
      throw new Error("Not needed in this spec");
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

  private matchesWhere(client: Client, where: Prisma.ClientWhereInput): boolean {
    const idMatches = this.matchesId(client, where.id);
    const organizationMatches = !where.organizationId || where.organizationId === client.organizationId;
    const typeMatches = !where.type || where.type === client.type;
    const statusMatches = this.matchesStatus(client, where.status);
    const cityMatches = this.matchesContains(client.city, where.city);
    const orMatches = !where.OR || where.OR.some((condition) => this.matchesWhere(client, condition));

    return idMatches && organizationMatches && typeMatches && statusMatches && cityMatches && orMatches;
  }

  private matchesId(client: Client, id: Prisma.StringFilter<"Client"> | string | undefined): boolean {
    if (!id) {
      return true;
    }
    if (typeof id === "string") {
      return client.id === id;
    }
    if (id.not && typeof id.not === "string") {
      return client.id !== id.not;
    }
    return true;
  }

  private matchesStatus(client: Client, status: Prisma.EnumClientStatusFilter<"Client"> | ClientStatus | undefined): boolean {
    if (!status) {
      return true;
    }
    if (typeof status === "string") {
      return client.status === status;
    }
    return status.not ? client.status !== status.not : true;
  }

  private matchesContains(value: string | null, filter: Prisma.StringNullableFilter<"Client"> | string | null | undefined): boolean {
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
}

describe("ClientsService", () => {
  let service: ClientsService;

  beforeEach(() => {
    service = new ClientsService(new FakePrismaService() as unknown as PrismaService);
  });

  it("validates natural person names", () => {
    expect(() =>
      service.mapClientInput({
        type: ClientType.NATURAL_PERSON,
        firstName: "Ada"
      })
    ).toThrow(BadRequestException);
  });

  it("validates legal entity name", () => {
    expect(() =>
      service.mapClientInput({
        type: ClientType.LEGAL_ENTITY
      })
    ).toThrow(BadRequestException);
  });

  it("normalizes email and calculates displayName", () => {
    const data = service.mapClientInput({
      type: ClientType.NATURAL_PERSON,
      firstName: " Ada ",
      lastName: " Lovelace ",
      email: " ADA@Example.COM "
    });

    expect(data.displayName).toBe("Ada Lovelace");
    expect(data.email).toBe("ada@example.com");
  });

  it("paginates and filters by organization", async () => {
    await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace"
    });
    await service.create("org-b", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Grace",
      lastName: "Hopper"
    });

    const page = await service.list("org-a", { page: 1, pageSize: 20 });

    expect(page.total).toBe(1);
    expect(page.items[0]?.displayName).toBe("Ada Lovelace");
  });

  it("archives clients without returning them by default", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.LEGAL_ENTITY,
      legalName: "Kaklen SpA",
      taxId: "76.000.000-1"
    });

    await service.archive("org-a", client.id, "user-1");
    const defaultList = await service.list("org-a", { page: 1, pageSize: 20 });
    const archivedList = await service.list("org-a", {
      page: 1,
      pageSize: 20,
      includeArchived: "true"
    });

    expect(defaultList.total).toBe(0);
    expect(archivedList.items[0]?.status).toBe(ClientStatus.ARCHIVED);
    expect(archivedList.items[0]?.archivedAt).toBeInstanceOf(Date);
  });

  it("keeps omitted fields on partial update", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      taxId: "NAT-1"
    });

    const updated = await service.update("org-a", client.id, "user-1", {
      status: ClientStatus.ACTIVE,
      city: "Valparaiso"
    });

    expect(updated.email).toBe("ada@example.com");
    expect(updated.taxId).toBe("NAT-1");
    expect(updated.city).toBe("Valparaiso");
    expect(updated.status).toBe(ClientStatus.ACTIVE);
  });
});
