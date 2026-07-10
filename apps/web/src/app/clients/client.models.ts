export type ClientType = "NATURAL_PERSON" | "LEGAL_ENTITY";
export type ClientStatus = "LEAD" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
export type ClientInteractionType = "NOTE" | "CALL" | "EMAIL" | "MEETING" | "WHATSAPP";

export interface Client {
  id: string;
  organizationId: string;
  type: ClientType;
  status: ClientStatus;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  legalName: string | null;
  taxId: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  country: string;
  region: string | null;
  city: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface ClientInteraction {
  id: string;
  type: ClientInteractionType;
  subject: string | null;
  description: string;
  occurredAt: string;
  createdAt: string;
}

export interface PaginatedClients {
  items: Client[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ClientSummary {
  total: number;
  leads: number;
  active: number;
  inactive: number;
  archived: number;
}
