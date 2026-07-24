import { CalendarProvider, CalendarSyncStatus } from "@prisma/client";

export interface GoogleTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

export interface GoogleCalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string } | { date: string };
  end: { dateTime: string; timeZone?: string } | { date: string };
  status: "confirmed" | "tentative" | "cancelled";
  attendees?: Array<{ email: string; displayName?: string; responseStatus?: string }>;
  htmlLink?: string;
}

export interface GoogleWebhookPayload {
  "x-goog-channel-id": string;
  "x-goog-resource-id": string;
  "x-goog-resource-state": "sync" | "exists" | "not_exists";
  "x-goog-message-number": string;
}

export interface CalendarIntegrationView {
  id: string;
  provider: CalendarProvider;
  calendarId: string;
  enabled: boolean;
  lastSyncAt: string | null;
  createdAt: string;
}

export interface CalendarSyncView {
  id: string;
  eventId: string;
  externalEventId: string;
  syncStatus: CalendarSyncStatus;
  lastSyncedAt: string | null;
  syncError: string | null;
}
