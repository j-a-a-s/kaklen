import { OrganizationRole } from "@prisma/client";
import { PERMISSIONS, permissionsForRole, roleHasPermissions } from "./permissions";

describe("organization permissions", () => {
  it("gives OWNER all permissions", () => {
    expect(permissionsForRole(OrganizationRole.OWNER)).toEqual(PERMISSIONS);
  });

  it("does not allow VIEWER to modify organizations", () => {
    expect(roleHasPermissions(OrganizationRole.VIEWER, ["organization.update"])).toBe(false);
  });

  it("allows ADMIN to invite members but not delete organizations", () => {
    expect(roleHasPermissions(OrganizationRole.ADMIN, ["organization.members.invite"])).toBe(true);
    expect(roleHasPermissions(OrganizationRole.ADMIN, ["organization.delete"])).toBe(false);
  });

  it("allows MEMBER to update clients but not invite members", () => {
    expect(roleHasPermissions(OrganizationRole.MEMBER, ["clients.update"])).toBe(true);
    expect(roleHasPermissions(OrganizationRole.MEMBER, ["organization.members.invite"])).toBe(false);
  });

  it("allows VIEWER to read catalog but not modify it", () => {
    expect(roleHasPermissions(OrganizationRole.VIEWER, ["catalog.read"])).toBe(true);
    expect(roleHasPermissions(OrganizationRole.VIEWER, ["catalog.update"])).toBe(false);
  });
});
