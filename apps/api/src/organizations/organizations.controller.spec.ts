import { OrganizationMembershipStatus, OrganizationRole } from "@prisma/client";
import { OrganizationsController } from "./organizations.controller";

describe("OrganizationsController", () => {
  it("delegates organization CRUD, members, invitations, and permissions", async () => {
    const service = makeOrganizationsService();
    const controller = new OrganizationsController(service as never);
    const authRequest = { user: { sub: "user-1" } };
    const organizationRequest = {
      user: { sub: "user-1" },
      organizationMembership: {
        id: "membership-1",
        organizationId: "org-1",
        userId: "user-1",
        role: OrganizationRole.OWNER,
        status: OrganizationMembershipStatus.ACTIVE
      }
    };

    await controller.create(authRequest as never, { name: "Kaklen" });
    await controller.list(authRequest as never);
    await controller.get("org-1");
    await controller.update("org-1", authRequest as never, { name: "Kaklen Pro" });
    await controller.members("org-1");
    await controller.updateMember("org-1", "membership-2", organizationRequest as never, { role: OrganizationRole.MEMBER });
    await controller.removeMember("org-1", "membership-2", organizationRequest as never);
    await controller.invite("org-1", authRequest as never, { email: "member@example.com", role: OrganizationRole.MEMBER });
    await controller.invitations("org-1");
    await controller.revokeInvitation("org-1", "invitation-1", authRequest as never);

    expect(controller.permissions(organizationRequest as never)).toEqual({ permissions: ["organization.read"] });
    expect(service.create).toHaveBeenCalledWith("user-1", { name: "Kaklen" });
    expect(service.updateMember).toHaveBeenCalledWith(
      "org-1",
      "membership-2",
      organizationRequest.organizationMembership,
      { role: OrganizationRole.MEMBER }
    );
    expect(service.removeMember).toHaveBeenCalledWith("org-1", "membership-2", organizationRequest.organizationMembership);
    expect(service.revokeInvitation).toHaveBeenCalledWith("org-1", "invitation-1", "user-1");
  });

  it("fails fast if a protected route reaches the controller without membership context", () => {
    const controller = new OrganizationsController(makeOrganizationsService() as never);

    expect(() => controller.permissions({ user: { sub: "user-1" } } as never)).toThrow("Organization membership was not loaded");
  });
});

function makeOrganizationsService() {
  const ok = async () => ({ id: "result" });
  return {
    create: jest.fn(ok),
    list: jest.fn(ok),
    get: jest.fn(ok),
    update: jest.fn(ok),
    members: jest.fn(ok),
    updateMember: jest.fn(ok),
    removeMember: jest.fn(async () => undefined),
    invite: jest.fn(ok),
    invitations: jest.fn(ok),
    revokeInvitation: jest.fn(async () => undefined),
    permissionsForMembership: jest.fn(() => ["organization.read"])
  };
}
