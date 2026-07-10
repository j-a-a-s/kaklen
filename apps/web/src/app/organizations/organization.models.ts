export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
export type Permission =
  | "organization.read"
  | "organization.update"
  | "organization.members.read"
  | "organization.members.invite"
  | "organization.members.update"
  | "organization.members.remove"
  | "organization.delete"
  | "clients.read"
  | "clients.create"
  | "clients.update"
  | "clients.delete"
  | "wallet.read"
  | "wallet.manage";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  country: string;
  currency: string;
  timezone: string;
  status: "ACTIVE" | "SUSPENDED" | "DELETED";
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  status: "ACTIVE" | "INVITED" | "SUSPENDED";
  joinedAt: string;
}

export interface OrganizationInvitation {
  id: string;
  email: string;
  role: OrganizationRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  invitationToken?: string;
}
