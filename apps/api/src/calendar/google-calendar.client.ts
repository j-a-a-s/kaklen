import { Injectable, Logger } from "@nestjs/common";
import { readCalendarConfig, type CalendarConfig } from "@kaklen/config";
import type { GoogleCalendarEvent, GoogleTokenResponse } from "./calendar.types";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SCOPES = ["https://www.googleapis.com/auth/calendar"];

@Injectable()
export class GoogleCalendarClient {
  private readonly logger = new Logger(GoogleCalendarClient.name);
  private readonly config: CalendarConfig;

  constructor() {
    this.config = readCalendarConfig(process.env);
  }

  getAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.googleClientId,
      redirect_uri: this.config.googleRedirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        redirect_uri: this.config.googleRedirectUri,
        grant_type: "authorization_code"
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Google token exchange failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to exchange authorization code");
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokenResponse> {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.googleClientId,
        client_secret: this.config.googleClientSecret,
        grant_type: "refresh_token"
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Google token refresh failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to refresh access token");
    }

    return response.json() as Promise<GoogleTokenResponse>;
  }

  async createEvent(
    accessToken: string,
    calendarId: string,
    event: Omit<GoogleCalendarEvent, "id">
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Google create event failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to create Google Calendar event");
    }

    return response.json() as Promise<GoogleCalendarEvent>;
  }

  async updateEvent(
    accessToken: string,
    calendarId: string,
    eventId: string,
    event: Partial<Omit<GoogleCalendarEvent, "id">>
  ): Promise<GoogleCalendarEvent> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(event)
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Google update event failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to update Google Calendar event");
    }

    return response.json() as Promise<GoogleCalendarEvent>;
  }

  async deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    if (!response.ok && response.status !== 410) {
      const errorBody = await response.text();
      this.logger.error(`Google delete event failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to delete Google Calendar event");
    }
  }

  async getEvent(accessToken: string, calendarId: string, eventId: string): Promise<GoogleCalendarEvent | null> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (response.status === 404 || response.status === 410) {
      return null;
    }

    if (!response.ok) {
      throw new Error("Failed to get Google Calendar event");
    }

    return response.json() as Promise<GoogleCalendarEvent>;
  }

  async watchCalendar(
    accessToken: string,
    calendarId: string,
    channelId: string,
    webhookUrl: string
  ): Promise<{ resourceId: string; expiration: string }> {
    const response = await fetch(
      `${GOOGLE_CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/watch`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: channelId,
          type: "web_hook",
          address: webhookUrl
        })
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`Google watch calendar failed: ${response.status} ${errorBody}`);
      throw new Error("Failed to set up calendar webhook");
    }

    const data = await response.json() as { resourceId: string; expiration: string };
    return data;
  }

  async stopWatching(accessToken: string, channelId: string, resourceId: string): Promise<void> {
    const response = await fetch(`${GOOGLE_CALENDAR_API}/channels/stop`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ id: channelId, resourceId })
    });

    if (!response.ok && response.status !== 404) {
      this.logger.warn(`Failed to stop calendar watch: ${response.status}`);
    }
  }
}
