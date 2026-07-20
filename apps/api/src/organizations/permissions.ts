import { OrganizationRole } from "@prisma/client";
import { roleHasPermissions as kokecoreRoleHasPermissions, Role } from "@kokecore/rbac";

export const PERMISSIONS = [
  "organization.read",
  "organization.update",
  "organization.members.read",
  "organization.members.invite",
  "organization.members.update",
  "organization.members.remove",
  "organization.delete",
  "clients.read",
  "clients.create",
  "clients.update",
  "clients.delete",
  "catalog.read",
  "catalog.create",
  "catalog.update",
  "catalog.delete",
  "quotations.read",
  "quotations.create",
  "quotations.update",
  "quotations.send",
  "quotations.approve",
  "quotations.reject",
  "quotations.delete",
  "events.read",
  "events.create",
  "events.update",
  "events.manage",
  "events.delete",
  "wallet.read",
  "wallet.manage"
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_PERMISSIONS: Record<OrganizationRole, readonly Permission[]> = {
  OWNER: PERMISSIONS,
  ADMIN: PERMISSIONS.filter((permission) => permission !== "organization.delete"),
  MANAGER: [
    "organization.read",
    "organization.members.read",
    "clients.read",
    "clients.create",
    "clients.update",
    "clients.delete",
    "catalog.read",
    "catalog.create",
    "catalog.update",
    "catalog.delete",
    "quotations.read",
    "quotations.create",
    "quotations.update",
    "quotations.send",
    "quotations.approve",
    "quotations.reject",
    "events.read",
    "events.create",
    "events.update",
    "events.manage",
    "wallet.read"
  ],
  MEMBER: [
    "organization.read",
    "clients.read",
    "clients.create",
    "clients.update",
    "catalog.read",
    "catalog.create",
    "catalog.update",
    "quotations.read",
    "quotations.create",
    "quotations.update",
    "events.read",
    "events.create",
    "events.update",
    "wallet.read"
  ],
  VIEWER: ["organization.read", "clients.read", "catalog.read", "quotations.read", "events.read"]
};

export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermissions(
  role: OrganizationRole,
  requiredPermissions: readonly Permission[]
): boolean {
  return kokecoreRoleHasPermissions(role as Role, requiredPermissions);
}
