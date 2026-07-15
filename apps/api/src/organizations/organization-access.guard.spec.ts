import { ForbiddenException, NotFoundException, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { OrganizationMembershipStatus, OrganizationRole, OrganizationStatus } from "@prisma/client";
import { OrganizationAccessGuard } from "./organization-access.guard";
import { REQUIRED_PERMISSIONS_KEY } from "./require-permissions.decorator";

describe("OrganizationAccessGuard", () => {
  it("rejects requests without organizationId", async () => {
    const guard = new OrganizationAccessGuard(makePrisma() as never, makeReflector([]));

    await expect(guard.canActivate(makeContext({ params: {}, user: { sub: "user-1" } }))).rejects.toBeInstanceOf(NotFoundException);
  });

  it("rejects users without active membership without leaking organization existence", async () => {
    const guard = new OrganizationAccessGuard(makePrisma({ membership: null }) as never, makeReflector(["clients.read"]));

    await expect(guard.canActivate(makeContext({ params: { organizationId: "org-b" }, user: { sub: "user-a" } }))).rejects.toBeInstanceOf(
      NotFoundException
    );
  });

  it("rejects active members missing the required backend permission", async () => {
    const guard = new OrganizationAccessGuard(
      makePrisma({ role: OrganizationRole.VIEWER }) as never,
      makeReflector(["clients.delete"])
    );

    await expect(guard.canActivate(makeContext({ params: { organizationId: "org-1" }, user: { sub: "user-1" } }))).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it("allows permitted members and stores the membership on the request", async () => {
    const request = { params: { organizationId: ["org-1"] }, user: { sub: "user-1" } };
    const guard = new OrganizationAccessGuard(
      makePrisma({ role: OrganizationRole.ADMIN }) as never,
      makeReflector(["organization.members.invite"])
    );

    await expect(guard.canActivate(makeContext(request))).resolves.toBe(true);
    expect(request).toMatchObject({
      organizationMembership: {
        organizationId: "org-1",
        userId: "user-1",
        role: OrganizationRole.ADMIN
      }
    });
  });

  it.each([
    [OrganizationRole.OWNER, "organization.delete", true],
    [OrganizationRole.ADMIN, "organization.delete", false],
    [OrganizationRole.MEMBER, "events.create", true],
    [OrganizationRole.MEMBER, "events.manage", false],
    [OrganizationRole.VIEWER, "quotations.read", true],
    [OrganizationRole.VIEWER, "quotations.approve", false]
  ] as const)("enforces the permission matrix for %s and %s", async (role, permission, allowed) => {
    const guard = new OrganizationAccessGuard(makePrisma({ role }) as never, makeReflector([permission]));
    const result = guard.canActivate(makeContext({ params: { organizationId: "org-1" }, user: { sub: "user-1" } }));

    if (allowed) {
      await expect(result).resolves.toBe(true);
    } else {
      await expect(result).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});

function makePrisma(options: { role?: OrganizationRole; membership?: unknown } = {}) {
  const membership =
    options.membership === undefined
      ? {
          id: "membership-1",
          organizationId: "org-1",
          userId: "user-1",
          role: options.role ?? OrganizationRole.OWNER,
          status: OrganizationMembershipStatus.ACTIVE,
          organization: { status: OrganizationStatus.ACTIVE, deletedAt: null }
        }
      : options.membership;

  return {
    organizationMembership: {
      findFirst: jest.fn(async () => membership)
    }
  };
}

function makeReflector(permissions: readonly string[]): Reflector {
  return {
    getAllAndOverride: jest.fn((key: string) => (key === REQUIRED_PERMISSIONS_KEY ? permissions : undefined))
  } as unknown as Reflector;
}

function makeContext(request: { params: Record<string, string | string[]>; user: { sub: string }; organizationMembership?: unknown }): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    }),
    getHandler: () => ({}),
    getClass: () => ({})
  } as unknown as ExecutionContext;
}
