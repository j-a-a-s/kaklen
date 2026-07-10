import { Client } from "../clients/client.models";

export type EventStatus = "DRAFT" | "CONFIRMED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export type EventTaskStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
export type EventTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type EventParticipantRole = "OWNER" | "COORDINATOR" | "STAFF" | "SUPPLIER" | "CLIENT_CONTACT" | "GUEST";

export interface EventTask {
  id: string;
  title: string;
  description: string | null;
  status: EventTaskStatus;
  priority: EventTaskPriority;
  assignedUserId: string | null;
  dueAt: string | null;
  completedAt: string | null;
}

export interface EventParticipant {
  id: string;
  userId: string | null;
  clientId: string | null;
  externalName: string | null;
  externalEmail: string | null;
  externalPhone: string | null;
  role: EventParticipantRole;
  notes: string | null;
}

export interface EventResource {
  id: string;
  catalogItemId: string | null;
  name: string;
  quantity: string;
  unit: string;
  unitCost: string | null;
  notes: string | null;
}

export interface EventTimelineEntry {
  id: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  sortOrder: number;
}

export interface Event {
  id: string;
  organizationId: string;
  clientId: string | null;
  quotationId: string | null;
  code: string;
  name: string;
  description: string | null;
  status: EventStatus;
  startAt: string;
  endAt: string;
  timezone: string;
  venueName: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  budget: string | null;
  currency: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  client?: Client | null;
  tasks?: EventTask[];
  participants?: EventParticipant[];
  resources?: EventResource[];
  timeline?: EventTimelineEntry[];
}

export interface EventPayload {
  clientId?: string | null;
  quotationId?: string;
  name: string;
  description?: string | null;
  startAt: string;
  endAt: string;
  timezone?: string;
  venueName?: string | null;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  budget?: number | null;
  currency?: string;
  notes?: string | null;
}

export interface PaginatedEvents {
  items: Event[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface EventSummary {
  total: number;
  draft: number;
  confirmed: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  archived: number;
}

export interface CalendarEvent {
  id: string;
  code: string;
  name: string;
  status: EventStatus;
  startAt: string;
  endAt: string;
  client: { displayName: string } | null;
  venueName: string | null;
  city: string | null;
}
