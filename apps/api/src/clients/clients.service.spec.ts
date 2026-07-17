import { BadRequestException } from "@nestjs/common";
import { Client, ClientInteraction, ClientInteractionType, ClientStatus, ClientType, Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { ClientsService } from "./clients.service";

class FakePrismaService {
  private clients: Client[] = [];
  private clientInteractions: ClientInteraction[] = [];

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
    create: async ({ data }: { data: Prisma.ClientInteractionUncheckedCreateInput }): Promise<ClientInteraction> => {
      const interaction: ClientInteraction = {
        id: `interaction-${this.clientInteractions.length + 1}`,
        organizationId: data.organizationId,
        clientId: data.clientId,
        userId: data.userId,
        type: data.type,
        subject: data.subject ?? null,
        description: data.description,
        occurredAt: data.occurredAt instanceof Date ? data.occurredAt : new Date(data.occurredAt ?? Date.now()),
        createdAt: new Date()
      };
      this.clientInteractions.push(interaction);
      return interaction;
    },
    findMany: async ({ where }: { where: Prisma.ClientInteractionWhereInput }): Promise<ClientInteraction[]> => {
      return this.clientInteractions.filter((interaction) => interaction.organizationId === where.organizationId && interaction.clientId === where.clientId);
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
    const taxIdMatches = this.matchesTaxId(client, where.taxId);
    const orMatches = !where.OR || where.OR.some((condition) => this.matchesWhere(client, condition));

    return idMatches && organizationMatches && typeMatches && statusMatches && cityMatches && taxIdMatches && orMatches;
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

  private matchesTaxId(client: Client, taxId: Prisma.StringNullableFilter<"Client"> | string | null | undefined): boolean {
    if (!taxId) {
      return true;
    }
    if (typeof taxId === "string") {
      return client.taxId === taxId;
    }
    if (taxId.not && typeof taxId.not === "string") {
      return client.taxId !== taxId.not;
    }
    return true;
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
      email: " ADA@Example.COM ",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });

    expect(data.displayName).toBe("Ada Lovelace");
    expect(data.email).toBe("ada@example.com");
  });

  it("paginates and filters by organization", async () => {
    await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });
    await service.create("org-b", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Grace",
      lastName: "Hopper",
      taxId: "11.111.111-1",
      whatsapp: "+56 9 8765 4321"
    });

    const page = await service.list("org-a", { page: 1, pageSize: 20 });

    expect(page.total).toBe(1);
    expect(page.items[0]?.displayName).toBe("Ada Lovelace");
  });

  it("applies all list filters without leaking other organizations", async () => {
    await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      status: ClientStatus.ACTIVE,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      city: "Santiago",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });
    await service.create("org-a", "user-1", {
      type: ClientType.LEGAL_ENTITY,
      legalName: "Grace SpA",
      country: "BR",
      city: "Valparaiso"
    });

    const page = await service.list("org-a", {
      page: 1,
      pageSize: 20,
      type: ClientType.NATURAL_PERSON,
      status: ClientStatus.ACTIVE,
      city: "santi",
      search: "ADA"
    });

    expect(page.total).toBe(1);
    expect(page.items[0]?.taxId).toBe("123456785");
  });

  it("archives clients without returning them by default", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.LEGAL_ENTITY,
      legalName: "Kaklen SpA",
      taxId: "11.111.111-1",
      whatsapp: "+56 9 1234 5678"
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
      taxId: "NAT-1",
      country: "BR"
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

  it("updates every writable field when values are explicitly provided", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace",
      email: "ada@example.com",
      phone: "+56 2 2345 6789",
      whatsapp: "+56 9 1234 5678",
      taxId: "12.345.678-5",
      country: "CL",
      region: "RM",
      city: "Santiago",
      address: "Old street",
      notes: "Old notes"
    });

    const updated = await service.update("org-a", client.id, "user-1", {
      type: ClientType.LEGAL_ENTITY,
      status: ClientStatus.INACTIVE,
      firstName: "Ignored",
      lastName: "Ignored",
      legalName: "  Kaklen SpA ",
      taxId: "12.345.678-5",
      email: " CONTACT@KAKLEN.CL ",
      phone: "+55 11 91234 5678",
      whatsapp: "+55 11 99876 5432",
      country: "BR",
      region: "SP",
      city: "Sao Paulo",
      address: "New street",
      notes: "Updated notes"
    });

    expect(updated).toMatchObject({
      type: ClientType.LEGAL_ENTITY,
      status: ClientStatus.INACTIVE,
      displayName: "Kaklen SpA",
      firstName: null,
      lastName: null,
      legalName: "Kaklen SpA",
      taxId: "123456785",
      email: "contact@kaklen.cl",
      phone: "+5511912345678",
      whatsapp: "+5511998765432",
      country: "BR",
      region: "SP",
      city: "Sao Paulo",
      address: "New street",
      notes: "Updated notes"
    });
  });

  it("rejects duplicate tax IDs inside the same organization", async () => {
    await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });

    await expect(
      service.create("org-a", "user-1", {
        type: ClientType.LEGAL_ENTITY,
        legalName: "Ada SpA",
        taxId: "123456785",
        whatsapp: "+56 9 8765 4321"
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "DUPLICATE_TAX_ID" })
    });
  });

  it("requires a RUT for every Chilean client", () => {
    expect(() => service.mapClientInput({ type: ClientType.NATURAL_PERSON, firstName: "Ada", lastName: "Lovelace", country: "CL", whatsapp: "+56 9 1234 5678" })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: "RUT_REQUIRED" }) })
    );
  });

  it("requires a valid WhatsApp number for every Chilean client", () => {
    expect(() => service.mapClientInput({ type: ClientType.LEGAL_ENTITY, legalName: "Empresa", country: "CL", taxId: "12.345.678-5" })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: "WHATSAPP_REQUIRED" }) })
    );
    expect(() => service.mapClientInput({ type: ClientType.LEGAL_ENTITY, legalName: "Empresa", country: "CL", taxId: "12.345.678-5", whatsapp: "123" })).toThrow(
      expect.objectContaining({ response: expect.objectContaining({ code: "WHATSAPP_INVALID" }) })
    );
  });

  it("summarizes clients and manages interactions", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      status: ClientStatus.ACTIVE,
      firstName: "Ada",
      lastName: "Lovelace",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });
    await service.create("org-a", "user-1", {
      type: ClientType.LEGAL_ENTITY,
      status: ClientStatus.INACTIVE,
      legalName: "Grace SpA",
      country: "BR"
    });

    await expect(service.summary("org-a")).resolves.toMatchObject({
      total: 2,
      active: 1,
      inactive: 1
    });
    await expect(
      service.createInteraction("org-a", client.id, "user-1", {
        type: ClientInteractionType.NOTE,
        subject: "  Call ",
        description: " Follow up ",
        occurredAt: "2026-08-01T10:00:00.000Z"
      })
    ).resolves.toMatchObject({
      subject: "Call",
      description: "Follow up"
    });
    await expect(service.interactions("org-a", client.id)).resolves.toHaveLength(1);
  });

  it("rejects direct access to clients outside the organization", async () => {
    const client = await service.create("org-a", "user-1", {
      type: ClientType.NATURAL_PERSON,
      firstName: "Ada",
      lastName: "Lovelace",
      taxId: "12.345.678-5",
      whatsapp: "+56 9 1234 5678"
    });

    await expect(service.get("org-b", client.id)).rejects.toThrow("Client not found");
    await expect(
      service.createInteraction("org-b", client.id, "user-1", { type: ClientInteractionType.NOTE, description: "Nope" })
    ).rejects.toThrow("Client not found");
  });
});
