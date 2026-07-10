import { OrganizationRole } from "@prisma/client";

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
    "wallet.read"
  ],
  VIEWER: ["organization.read", "clients.read", "catalog.read"]
};

export function permissionsForRole(role: OrganizationRole): readonly Permission[] {
  return ROLE_PERMISSIONS[role];
}

export function roleHasPermissions(
  role: OrganizationRole,
  requiredPermissions: readonly Permission[]
): boolean {
  const permissions = permissionsForRole(role);
  return requiredPermissions.every((permission) => permissions.includes(permission));
}
