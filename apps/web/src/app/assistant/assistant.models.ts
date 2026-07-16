export type ActivationStep =
  | "organization_configured"
  | "first_client_created"
  | "first_catalog_item_created"
  | "first_quotation_created"
  | "first_quotation_sent"
  | "first_quotation_approved"
  | "first_event_created";

export interface UserActivation {
  completedSteps: ActivationStep[];
  totalSteps: number;
  percentage: number;
  currentStep: ActivationStep | null;
  nextRecommendedAction: ActivationStep | "create_opportunity";
  isCompleted: boolean;
}

export type SearchResultType = "client" | "catalog_item" | "quotation" | "event";

export interface GlobalSearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  status: string;
  route: string;
  match: string;
}

export interface GlobalSearchResponse {
  query: string;
  groups: {
    clients: GlobalSearchResult[];
    catalogItems: GlobalSearchResult[];
    quotations: GlobalSearchResult[];
    events: GlobalSearchResult[];
  };
}

export interface OrganizationActivityItem {
  id: string;
  action: string;
  actor: { id: string; name: string };
  resource: { id: string; type: SearchResultType | "organization"; title: string; status: string | null; route: string };
  occurredAt: string;
}

export interface ClientTimelineItem {
  id: string;
  type: string;
  description: string;
  actor: { id: string; name: string } | null;
  resource: { id: string; type: string; title: string; route: string };
  status: string | null;
  occurredAt: string;
}

export interface AssistedDashboard {
  activation: UserActivation;
  counts: {
    upcomingEvents: number;
    pendingQuotations: number;
    expiringQuotations: number;
    urgentTasks: number;
    clientsWithoutRecentInteraction: number;
  };
  upcomingEvents: Array<{ id: string; name: string; startAt: string; status: string; route: string }>;
  pendingQuotations: Array<{ id: string; number: string; validUntil: string; status: string; clientName: string; route: string }>;
  urgentTasks: Array<{ id: string; title: string; dueAt: string | null; eventName: string; route: string }>;
  staleClients: Array<{ id: string; displayName: string; updatedAt: string; route: string }>;
  recentActivity: OrganizationActivityItem[];
  recommendedAction: { kind: string; route: string; resourceId: string | null };
}
