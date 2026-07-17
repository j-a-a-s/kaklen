import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import {
  Organization,
  OrganizationInvitation,
  OrganizationMembership,
  OrganizationMembershipStatus,
  OrganizationRole,
  OrganizationStatus,
  Prisma,
  User,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { OrganizationsService } from "./organizations.service";

describe("OrganizationsService", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "test";
    process.env.ORGANIZATION_INVITATION_EXPIRES_SECONDS = "604800";
  });

  it("creates an organization with normalized fields, owner membership, and audit trail", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    const created = await service.create("user-1", {
      name: "  Ángela Eventos ",
      legalName: " Ángela Eventos SpA ",
      taxId: "76123456-7",
      country: "cl",
      currency: "clp",
      timezone: "America/Santiago",
      dateFormat: "dd-MM-yyyy",
      numberFormat: "es"
    });

    expect(created.slug).toBe("angela-eventos");
    expect(prisma.organization.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Ángela Eventos",
        legalName: "Ángela Eventos SpA",
        taxId: "76123456-7",
        country: "CL",
        currency: "CLP",
        createdByUserId: "user-1"
      })
    });
    expect(prisma.organizationMembership.create).toHaveBeenCalledWith({
      data: {
        organizationId: "org-1",
        userId: "user-1",
        role: OrganizationRole.OWNER,
        status: OrganizationMembershipStatus.ACTIVE
      }
    });
  });

  it("generates unique slugs and falls back when the name has no slug characters", async () => {
    const prisma = makeOrganizationsPrisma({ existingSlugCount: 1 });
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await service.create("user-1", { name: "Kaklen Demo" });
    const probe = service as unknown as { slugify(name: string): string };

    expect(callData(prisma.organization.create)).toMatchObject({ slug: "kaklen-demo-2" });
    expect(probe.slugify("   !!!   ")).toMatch(/^org-[a-f0-9]{8}$/);
  });

  it("lists only active memberships and maps organization responses", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await expect(service.list("user-1")).resolves.toEqual([
      expect.objectContaining({ id: "org-1", name: "Kaklen", status: OrganizationStatus.ACTIVE })
    ]);
    expect(prisma.organizationMembership.findMany).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        status: OrganizationMembershipStatus.ACTIVE,
        organization: { status: { not: OrganizationStatus.DELETED }, deletedAt: null }
      },
      include: { organization: true },
      orderBy: { joinedAt: "asc" }
    });
  });

  it("returns and updates active organizations while rejecting missing organizations", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await expect(service.get("org-1")).resolves.toMatchObject({ id: "org-1" });
    await expect(
      service.update("org-1", "user-1", {
        name: " Kaklen Pro ",
        legalName: "",
        taxId: null,
        country: "br",
        currency: "brl",
        defaultLocale: "pt-BR"
      })
    ).resolves.toMatchObject({ name: "Kaklen Pro" });
    expect(prisma.organization.update).toHaveBeenCalledWith({
      where: { id: "org-1" },
      data: expect.objectContaining({
        name: "Kaklen Pro",
        legalName: null,
        taxId: null,
        country: "BR",
        currency: "BRL",
        defaultLocale: "pt-BR"
      })
    });

    mockResolvedValueOnce(prisma.organization.findFirst, null);
    await expect(service.get("org-missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("lists members and applies RBAC rules to membership changes", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);
    const ownerActor = membership({ id: "membership-owner", role: OrganizationRole.OWNER, userId: "owner-1" });
    const adminActor = membership({ id: "membership-admin", role: OrganizationRole.ADMIN, userId: "admin-1" });

    await expect(service.members("org-1")).resolves.toEqual([
      expect.objectContaining({ email: "member@example.com", role: OrganizationRole.MEMBER })
    ]);
    await expect(
      service.updateMember("org-1", "membership-member", ownerActor, {
        role: OrganizationRole.MANAGER,
        status: OrganizationMembershipStatus.ACTIVE
      })
    ).resolves.toMatchObject({ role: OrganizationRole.MANAGER });

    mockResolvedValueOnce(prisma.organizationMembership.findFirst, memberWithUser({ role: OrganizationRole.OWNER }));
    await expect(
      service.updateMember("org-1", "membership-owner", adminActor, { role: OrganizationRole.ADMIN })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("prevents changing or removing the last active owner", async () => {
    const prisma = makeOrganizationsPrisma({ remainingOwners: 0 });
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);
    const ownerActor = membership({ role: OrganizationRole.OWNER, userId: "owner-1" });

    mockResolvedValueOnce(prisma.organizationMembership.findFirst, memberWithUser({ id: "membership-owner", role: OrganizationRole.OWNER }));
    await expect(
      service.updateMember("org-1", "membership-owner", ownerActor, { role: OrganizationRole.ADMIN })
    ).rejects.toBeInstanceOf(ConflictException);
    mockResolvedValueOnce(prisma.organizationMembership.findFirst, memberWithUser({ id: "membership-owner", role: OrganizationRole.OWNER }));
    await expect(service.removeMember("org-1", "membership-owner", ownerActor)).rejects.toBeInstanceOf(ConflictException);
  });

  it("removes non-owner members and writes audit trail", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await service.removeMember("org-1", "membership-member", membership({ role: OrganizationRole.OWNER, userId: "owner-1" }));

    expect(prisma.organizationMembership.delete).toHaveBeenCalledWith({ where: { id: "membership-member" } });
    expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "membership.removed", targetId: "membership-member" })
    });
  });

  it("rejects direct owner invitations and creates member invitations with non-production token", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await expect(service.invite("org-1", "owner-1", { email: "owner@example.com", role: OrganizationRole.OWNER })).rejects.toBeInstanceOf(
      BadRequestException
    );

    const invitation = await service.invite("org-1", "owner-1", { email: " New.Member@Example.com ", role: OrganizationRole.MEMBER });

    expect(invitation.email).toBe("new.member@example.com");
    expect(invitation.invitationToken).toEqual(expect.any(String));
    expect(prisma.organizationInvitation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: "org-1",
        email: "new.member@example.com",
        role: OrganizationRole.MEMBER,
        invitedByUserId: "owner-1"
      })
    });
  });

  it("hides invitation tokens in production and lists invitations", async () => {
    process.env.NODE_ENV = "production";
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await expect(service.invitations("org-1")).resolves.toEqual([
      expect.objectContaining({ id: "invitation-1", invitationToken: undefined })
    ]);
  });

  it("revokes invitations and rejects revoking a foreign invitation", async () => {
    const prisma = makeOrganizationsPrisma();
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await service.revokeInvitation("org-1", "invitation-1", "owner-1");
    expect(prisma.organizationInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: { revokedAt: expect.any(Date) }
    });

    mockResolvedValueOnce(prisma.organizationInvitation.findFirst, null);
    await expect(service.revokeInvitation("org-1", "invitation-b", "owner-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("accepts a valid invitation for the invited user and marks it used", async () => {
    const token = "valid-invitation-token";
    const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
    const prisma = makeOrganizationsPrisma({ invitationTokenHash: tokenHash });
    const service = new OrganizationsService(prisma as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    await expect(service.acceptInvitation("user-2", { token })).resolves.toMatchObject({ id: "org-1" });
    expect(prisma.organizationMembership.upsert).toHaveBeenCalledWith({
      where: { organizationId_userId: { organizationId: "org-1", userId: "user-2" } },
      update: { role: OrganizationRole.MEMBER, status: OrganizationMembershipStatus.ACTIVE, joinedAt: expect.any(Date) },
      create: {
        organizationId: "org-1",
        userId: "user-2",
        role: OrganizationRole.MEMBER,
        status: OrganizationMembershipStatus.ACTIVE
      }
    });
    expect(prisma.organizationInvitation.update).toHaveBeenCalledWith({
      where: { id: "invitation-1" },
      data: { acceptedAt: expect.any(Date) }
    });
  });

  it("rejects invitations for the wrong user or invalid tokens", async () => {
    const token = "valid-invitation-token";
    const tokenHash = await argon2.hash(token, { type: argon2.argon2id });
    const wrongUser = makeOrganizationsPrisma({
      invitationTokenHash: tokenHash,
      invitedUser: user({ id: "user-2", email: "other@example.com" })
    });
    const invalidToken = makeOrganizationsPrisma({ invitationTokenHash: tokenHash });

    await expect(
      new OrganizationsService(wrongUser as unknown as ConstructorParameters<typeof OrganizationsService>[0]).acceptInvitation("user-2", {
        token
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      new OrganizationsService(invalidToken as unknown as ConstructorParameters<typeof OrganizationsService>[0]).acceptInvitation("user-2", {
        token: "not-the-token"
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("returns permission sets for each membership role", () => {
    const service = new OrganizationsService(makeOrganizationsPrisma() as unknown as ConstructorParameters<typeof OrganizationsService>[0]);

    expect(service.permissionsForMembership(membership({ role: OrganizationRole.OWNER }))).toContain("organization.delete");
    expect(service.permissionsForMembership(membership({ role: OrganizationRole.VIEWER }))).toEqual([
      "organization.read",
      "clients.read",
      "catalog.read",
      "quotations.read",
      "events.read"
    ]);
  });
});

function makeOrganizationsPrisma(options: {
  existingSlugCount?: number;
  remainingOwners?: number;
  invitationTokenHash?: string;
  invitedUser?: User | null;
} = {}) {
  let slugLookupCount = 0;
  const currentOrganization = organization();
  const invitation = organizationInvitation({ tokenHash: options.invitationTokenHash });
  const memberRecord = {
    ...membership({ id: "membership-member", role: OrganizationRole.MEMBER, userId: "user-2" }),
    user: user({ id: "user-2", email: "member@example.com" })
  };
  const tx = {
    organization: {
      findUnique: jest.fn(async () => {
        slugLookupCount += 1;
        return slugLookupCount <= (options.existingSlugCount ?? 0) ? currentOrganization : null;
      }),
      create: jest.fn(async ({ data }: { data: { name: string; slug: string } }) => organization({ name: data.name, slug: data.slug })),
      findFirst: jest.fn(async () => currentOrganization),
      update: jest.fn(async ({ data }: { data: Partial<Organization> }) => organization({ ...currentOrganization, ...data }))
    },
    organizationMembership: {
      create: jest.fn(async () => membership()),
      findMany: jest.fn(async (args: unknown) =>
        hasOrganizationInclude(args) ? [{ organization: currentOrganization }] : [memberRecord]
      ),
      findFirst: jest.fn(async () => memberRecord),
      update: jest.fn(async ({ data }: { data: Partial<OrganizationMembership> }) =>
        memberWithUser({
          role: data.role ?? OrganizationRole.MEMBER,
          status: data.status ?? OrganizationMembershipStatus.ACTIVE
        })
      ),
      delete: jest.fn(async () => memberRecord),
      count: jest.fn(async () => options.remainingOwners ?? 1),
      upsert: jest.fn(async () => memberRecord)
    },
    organizationInvitation: {
      create: jest.fn(async ({ data }: { data: Partial<OrganizationInvitation> }) =>
        organizationInvitation({
          email: data.email,
          role: data.role,
          tokenHash: data.tokenHash,
          expiresAt: data.expiresAt,
          invitedByUserId: data.invitedByUserId
        })
      ),
      findMany: jest.fn(async () => [invitation]),
      findFirst: jest.fn(async () => invitation),
      update: jest.fn(async () => organizationInvitation({ ...invitation, revokedAt: new Date(), acceptedAt: new Date() }))
    },
    user: {
      findUnique: jest.fn(async () => (options.invitedUser === undefined ? user({ id: "user-2", email: "member@example.com" }) : options.invitedUser))
    },
    organizationAuditLog: { create: jest.fn(async () => ({ id: "audit-1" })) }
  };

  return {
    ...tx,
    $transaction: jest.fn(async (callback: unknown) => (callback as (transaction: typeof tx) => Promise<unknown>)(tx))
  };
}

function organization(overrides: Partial<Organization> = {}): Organization {
  const now = new Date("2026-07-15T00:00:00.000Z");
  return {
    id: "org-1",
    name: "Kaklen",
    slug: "kaklen",
    legalName: null,
    taxId: "76123456-7",
    country: "CL",
    currency: "CLP",
    timezone: "America/Santiago",
    dateFormat: "dd-MM-yyyy",
    numberFormat: "es",
    defaultLocale: "es",
    address: null,
    phone: null,
    whatsapp: null,
    status: OrganizationStatus.ACTIVE,
    createdByUserId: "user-1",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    ...overrides
  };
}

function membership(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership {
  const now = new Date("2026-07-15T00:00:00.000Z");
  return {
    id: "membership-member",
    organizationId: "org-1",
    userId: "user-2",
    role: OrganizationRole.MEMBER,
    status: OrganizationMembershipStatus.ACTIVE,
    joinedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function memberWithUser(overrides: Partial<OrganizationMembership> = {}): OrganizationMembership & { user: User } {
  return {
    ...membership(overrides),
    user: user({ id: overrides.userId ?? "user-2", email: "member@example.com" })
  };
}

function organizationInvitation(overrides: Partial<OrganizationInvitation> = {}): OrganizationInvitation & { organization: Organization } {
  const now = new Date("2026-07-15T00:00:00.000Z");
  return {
    id: "invitation-1",
    organizationId: "org-1",
    email: "member@example.com",
    role: OrganizationRole.MEMBER,
    tokenHash: "hash",
    expiresAt: new Date("2026-07-22T00:00:00.000Z"),
    acceptedAt: null,
    revokedAt: null,
    invitedByUserId: "owner-1",
    createdAt: now,
    organization: organization(),
    ...overrides
  };
}

function user(overrides: Partial<User> = {}): User {
  const now = new Date("2026-07-15T00:00:00.000Z");
  return {
    id: "user-2",
    email: "member@example.com",
    firstName: "Member",
    lastName: "User",
    passwordHash: "hash",
    authVersion: 0,
    locale: "es",
    status: UserStatus.ACTIVE,
    emailVerifiedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function callData(mock: { mock: { calls: unknown[][] } }): unknown {
  const call = mock.mock.calls[0]?.[0] as { data?: unknown } | undefined;
  return call?.data;
}

function mockResolvedValueOnce(mock: { mockResolvedValueOnce(value: unknown): unknown }, value: unknown): void {
  mock.mockResolvedValueOnce(value);
}

function hasOrganizationInclude(args: unknown): boolean {
  const value = args as { include?: { organization?: boolean } };
  return value.include?.organization === true;
}
