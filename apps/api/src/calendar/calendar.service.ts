import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { CalendarProvider, CalendarSyncStatus, EventStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { readCalendarConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import { GoogleCalendarClient } from "./google-calendar.client";
import type { CalendarIntegrationView, CalendarSyncView, GoogleCalendarEvent } from "./calendar.types";

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);
  private readonly calendarConfig = readCalendarConfig(process.env);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleClient: GoogleCalendarClient
  ) {}

  getGoogleAuthUrl(userId: string, organizationId: string): string {
    this.assertEnabled();
    const state = Buffer.from(JSON.stringify({ userId, organizationId })).toString("base64url");
    return this.googleClient.getAuthorizationUrl(state);
  }

  async connectGoogle(
    userId: string,
    organizationId: string,
    code: string,
    calendarId?: string
  ): Promise<CalendarIntegrationView> {
    this.assertEnabled();
    const tokens = await this.googleClient.exchangeCode(code);

    if (!tokens.refresh_token) {
      throw new BadRequestException("No refresh token received. Please revoke access and try again.");
    }

    const integration = await this.prisma.calendarIntegration.upsert({
      where: {
        userId_organizationId_provider: {
          userId,
          organizationId,
          provider: CalendarProvider.GOOGLE
        }
      },
      create: {
        userId,
        organizationId,
        provider: CalendarProvider.GOOGLE,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        calendarId: calendarId ?? "primary"
      },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        calendarId: calendarId ?? "primary",
        enabled: true
      }
    });

    await this.setupWebhook(integration.id);

    return this.toIntegrationView(integration);
  }

  async disconnect(userId: string, organizationId: string, integrationId: string): Promise<void> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { id: integrationId, userId, organizationId }
    });

    if (!integration) {
      throw new NotFoundException("Calendar integration not found");
    }

    if (integration.webhookChannelId && integration.webhookResourceId) {
      const accessToken = await this.getValidAccessToken(integration.id);
      await this.googleClient.stopWatching(
        accessToken,
        integration.webhookChannelId,
        integration.webhookResourceId
      ).catch((error) => this.logger.warn(`Failed to stop webhook: ${error}`));
    }

    await this.prisma.calendarIntegration.delete({ where: { id: integrationId } });
  }

  async listIntegrations(userId: string, organizationId: string): Promise<CalendarIntegrationView[]> {
    const integrations = await this.prisma.calendarIntegration.findMany({
      where: { userId, organizationId },
      orderBy: { createdAt: "desc" }
    });
    return integrations.map((i) => this.toIntegrationView(i));
  }

  async syncEventToCalendar(
    userId: string,
    organizationId: string,
    eventId: string
  ): Promise<CalendarSyncView> {
    this.assertEnabled();
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { userId, organizationId, provider: CalendarProvider.GOOGLE, enabled: true }
    });

    if (!integration) {
      throw new BadRequestException("No active Google Calendar integration found");
    }

    const event = await this.prisma.event.findFirst({
      where: { id: eventId, organizationId }
    });

    if (!event) {
      throw new NotFoundException("Event not found");
    }

    if (event.status === EventStatus.ARCHIVED || event.status === EventStatus.CANCELLED) {
      throw new BadRequestException("Cannot sync archived or cancelled events");
    }

    const accessToken = await this.getValidAccessToken(integration.id);
    const googleEvent = this.toGoogleEvent(event);

    const existingSync = await this.prisma.calendarEventSync.findUnique({
      where: { calendarIntegrationId_eventId: { calendarIntegrationId: integration.id, eventId } }
    });

    try {
      let externalEventId: string;

      if (existingSync) {
        const updated = await this.googleClient.updateEvent(
          accessToken,
          integration.calendarId,
          existingSync.externalEventId,
          googleEvent
        );
        externalEventId = updated.id;
      } else {
        const created = await this.googleClient.createEvent(
          accessToken,
          integration.calendarId,
          googleEvent
        );
        externalEventId = created.id;
      }

      const sync = await this.prisma.calendarEventSync.upsert({
        where: { calendarIntegrationId_eventId: { calendarIntegrationId: integration.id, eventId } },
        create: {
          calendarIntegrationId: integration.id,
          eventId,
          externalEventId,
          syncStatus: CalendarSyncStatus.SYNCED,
          lastSyncedAt: new Date()
        },
        update: {
          externalEventId,
          syncStatus: CalendarSyncStatus.SYNCED,
          lastSyncedAt: new Date(),
          syncError: null
        }
      });

      await this.prisma.calendarIntegration.update({
        where: { id: integration.id },
        data: { lastSyncAt: new Date() }
      });

      return this.toSyncView(sync);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown sync error";

      if (existingSync) {
        await this.prisma.calendarEventSync.update({
          where: { id: existingSync.id },
          data: { syncStatus: CalendarSyncStatus.FAILED, syncError: errorMessage }
        });
      }

      throw new BadRequestException(`Calendar sync failed: ${errorMessage}`);
    }
  }

  async deleteEventFromCalendar(
    userId: string,
    organizationId: string,
    eventId: string
  ): Promise<void> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { userId, organizationId, provider: CalendarProvider.GOOGLE, enabled: true }
    });

    if (!integration) {
      return;
    }

    const sync = await this.prisma.calendarEventSync.findUnique({
      where: { calendarIntegrationId_eventId: { calendarIntegrationId: integration.id, eventId } }
    });

    if (!sync) {
      return;
    }

    try {
      const accessToken = await this.getValidAccessToken(integration.id);
      await this.googleClient.deleteEvent(accessToken, integration.calendarId, sync.externalEventId);
    } catch (error) {
      this.logger.warn(`Failed to delete event from Google Calendar: ${error}`);
    }

    await this.prisma.calendarEventSync.delete({ where: { id: sync.id } });
  }

  async handleWebhook(channelId: string, resourceId: string): Promise<void> {
    const integration = await this.prisma.calendarIntegration.findFirst({
      where: { webhookChannelId: channelId, webhookResourceId: resourceId, enabled: true }
    });

    if (!integration) {
      this.logger.warn(`Webhook received for unknown channel: ${channelId}`);
      return;
    }

    this.logger.log(`Calendar webhook received for integration ${integration.id}`);
    // Future: Implement incremental sync from Google → kaklen
    // For now, log the notification for observability
  }

  private async setupWebhook(integrationId: string): Promise<void> {
    if (!this.calendarConfig.webhookBaseUrl) {
      return;
    }

    const integration = await this.prisma.calendarIntegration.findUniqueOrThrow({
      where: { id: integrationId }
    });

    const channelId = randomUUID();
    const webhookUrl = `${this.calendarConfig.webhookBaseUrl}/api/calendar/webhook`;
    const accessToken = await this.getValidAccessToken(integrationId);

    try {
      const result = await this.googleClient.watchCalendar(
        accessToken,
        integration.calendarId,
        channelId,
        webhookUrl
      );

      await this.prisma.calendarIntegration.update({
        where: { id: integrationId },
        data: {
          webhookChannelId: channelId,
          webhookResourceId: result.resourceId,
          webhookExpiresAt: new Date(Number(result.expiration))
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to setup webhook for integration ${integrationId}: ${error}`);
    }
  }

  private async getValidAccessToken(integrationId: string): Promise<string> {
    const integration = await this.prisma.calendarIntegration.findUniqueOrThrow({
      where: { id: integrationId }
    });

    if (integration.tokenExpiresAt > new Date(Date.now() + 60_000)) {
      return integration.accessToken;
    }

    const tokens = await this.googleClient.refreshAccessToken(integration.refreshToken);

    await this.prisma.calendarIntegration.update({
      where: { id: integrationId },
      data: {
        accessToken: tokens.access_token,
        tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
        ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {})
      }
    });

    return tokens.access_token;
  }

  private toGoogleEvent(event: {
    name: string;
    description: string | null;
    startAt: Date;
    endAt: Date;
    timezone: string;
    venueName: string | null;
    address: string | null;
    city: string | null;
  }): Omit<GoogleCalendarEvent, "id"> {
    const location = [event.venueName, event.address, event.city]
      .filter(Boolean)
      .join(", ");

    return {
      summary: event.name,
      description: event.description ?? undefined,
      location: location || undefined,
      start: { dateTime: event.startAt.toISOString(), timeZone: event.timezone },
      end: { dateTime: event.endAt.toISOString(), timeZone: event.timezone },
      status: "confirmed"
    };
  }

  private assertEnabled(): void {
    if (!this.calendarConfig.enabled) {
      throw new ForbiddenException("Calendar integration is not enabled");
    }
  }

  private toIntegrationView(integration: {
    id: string;
    provider: CalendarProvider;
    calendarId: string;
    enabled: boolean;
    lastSyncAt: Date | null;
    createdAt: Date;
  }): CalendarIntegrationView {
    return {
      id: integration.id,
      provider: integration.provider,
      calendarId: integration.calendarId,
      enabled: integration.enabled,
      lastSyncAt: integration.lastSyncAt?.toISOString() ?? null,
      createdAt: integration.createdAt.toISOString()
    };
  }

  private toSyncView(sync: {
    id: string;
    eventId: string;
    externalEventId: string;
    syncStatus: CalendarSyncStatus;
    lastSyncedAt: Date | null;
    syncError: string | null;
  }): CalendarSyncView {
    return {
      id: sync.id,
      eventId: sync.eventId,
      externalEventId: sync.externalEventId,
      syncStatus: sync.syncStatus,
      lastSyncedAt: sync.lastSyncedAt?.toISOString() ?? null,
      syncError: sync.syncError
    };
  }
}
