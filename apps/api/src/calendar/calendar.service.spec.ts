import { ForbiddenException, BadRequestException, NotFoundException } from "@nestjs/common";
import { CalendarProvider, CalendarSyncStatus, EventStatus } from "@prisma/client";
import { CalendarService } from "./calendar.service";
import { GoogleCalendarClient } from "./google-calendar.client";

const mockPrisma = {
  calendarIntegration: {
    upsert: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUniqueOrThrow: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  calendarEventSync: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn()
  },
  event: {
    findFirst: jest.fn()
  }
};

const mockGoogleClient = {
  getAuthorizationUrl: jest.fn().mockReturnValue("https://accounts.google.com/o/oauth2/auth?state=test"),
  exchangeCode: jest.fn(),
  refreshAccessToken: jest.fn(),
  createEvent: jest.fn(),
  updateEvent: jest.fn(),
  deleteEvent: jest.fn(),
  getEvent: jest.fn(),
  watchCalendar: jest.fn(),
  stopWatching: jest.fn()
};

describe("CalendarService", () => {
  let service: CalendarService;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CALENDAR_SYNC_ENABLED = "true";
    process.env.GOOGLE_CALENDAR_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_CALENDAR_REDIRECT_URI = "http://localhost:4200/calendar/callback";
    process.env.CALENDAR_WEBHOOK_BASE_URL = "https://api.kaklen.com";

    service = new CalendarService(
      mockPrisma as never,
      mockGoogleClient as never
    );
  });

  afterEach(() => {
    delete process.env.CALENDAR_SYNC_ENABLED;
    delete process.env.GOOGLE_CALENDAR_CLIENT_ID;
    delete process.env.GOOGLE_CALENDAR_CLIENT_SECRET;
    delete process.env.GOOGLE_CALENDAR_REDIRECT_URI;
    delete process.env.CALENDAR_WEBHOOK_BASE_URL;
  });

  describe("getGoogleAuthUrl", () => {
    it("returns authorization URL with state", () => {
      const url = service.getGoogleAuthUrl("user-1", "org-1");
      expect(url).toContain("accounts.google.com");
      expect(mockGoogleClient.getAuthorizationUrl).toHaveBeenCalledWith(expect.any(String));
    });

    it("throws ForbiddenException when disabled", () => {
      process.env.CALENDAR_SYNC_ENABLED = "false";
      const disabledService = new CalendarService(mockPrisma as never, mockGoogleClient as never);
      expect(() => disabledService.getGoogleAuthUrl("user-1", "org-1")).toThrow(ForbiddenException);
    });
  });

  describe("connectGoogle", () => {
    it("exchanges code and creates integration", async () => {
      mockGoogleClient.exchangeCode.mockResolvedValue({
        access_token: "access-123",
        refresh_token: "refresh-123",
        expires_in: 3600
      });

      const integration = {
        id: "int-1",
        provider: CalendarProvider.GOOGLE,
        calendarId: "primary",
        enabled: true,
        lastSyncAt: null,
        createdAt: new Date()
      };
      mockPrisma.calendarIntegration.upsert.mockResolvedValue(integration);
      mockPrisma.calendarIntegration.findUniqueOrThrow.mockResolvedValue({
        ...integration,
        accessToken: "access-123",
        refreshToken: "refresh-123",
        tokenExpiresAt: new Date(Date.now() + 3600_000)
      });
      mockGoogleClient.watchCalendar.mockResolvedValue({
        resourceId: "res-1",
        expiration: String(Date.now() + 86400_000)
      });
      mockPrisma.calendarIntegration.update.mockResolvedValue(integration);

      const result = await service.connectGoogle("user-1", "org-1", "auth-code");
      expect(result.id).toBe("int-1");
      expect(result.provider).toBe(CalendarProvider.GOOGLE);
      expect(mockGoogleClient.exchangeCode).toHaveBeenCalledWith("auth-code");
    });

    it("throws when no refresh token received", async () => {
      mockGoogleClient.exchangeCode.mockResolvedValue({
        access_token: "access-123",
        expires_in: 3600
      });

      await expect(
        service.connectGoogle("user-1", "org-1", "auth-code")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("syncEventToCalendar", () => {
    const integration = {
      id: "int-1",
      provider: CalendarProvider.GOOGLE,
      calendarId: "primary",
      enabled: true,
      accessToken: "access-123",
      refreshToken: "refresh-123",
      tokenExpiresAt: new Date(Date.now() + 3600_000)
    };

    const event = {
      id: "event-1",
      organizationId: "org-1",
      name: "Wedding",
      description: "A beautiful wedding",
      startAt: new Date("2026-08-01T10:00:00Z"),
      endAt: new Date("2026-08-01T18:00:00Z"),
      timezone: "America/Santiago",
      venueName: "Garden Hall",
      address: "123 Main St",
      city: "Santiago",
      status: EventStatus.CONFIRMED
    };

    it("creates event in Google Calendar when no existing sync", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(integration);
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.calendarEventSync.findUnique.mockResolvedValue(null);
      mockPrisma.calendarIntegration.findUniqueOrThrow.mockResolvedValue(integration);
      mockGoogleClient.createEvent.mockResolvedValue({ id: "google-event-1" });
      mockPrisma.calendarEventSync.upsert.mockResolvedValue({
        id: "sync-1",
        eventId: "event-1",
        externalEventId: "google-event-1",
        syncStatus: CalendarSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null
      });
      mockPrisma.calendarIntegration.update.mockResolvedValue(integration);

      const result = await service.syncEventToCalendar("user-1", "org-1", "event-1");
      expect(result.externalEventId).toBe("google-event-1");
      expect(result.syncStatus).toBe(CalendarSyncStatus.SYNCED);
      expect(mockGoogleClient.createEvent).toHaveBeenCalled();
    });

    it("updates event in Google Calendar when sync already exists", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(integration);
      mockPrisma.event.findFirst.mockResolvedValue(event);
      mockPrisma.calendarEventSync.findUnique.mockResolvedValue({
        id: "sync-1",
        externalEventId: "google-event-1"
      });
      mockPrisma.calendarIntegration.findUniqueOrThrow.mockResolvedValue(integration);
      mockGoogleClient.updateEvent.mockResolvedValue({ id: "google-event-1" });
      mockPrisma.calendarEventSync.upsert.mockResolvedValue({
        id: "sync-1",
        eventId: "event-1",
        externalEventId: "google-event-1",
        syncStatus: CalendarSyncStatus.SYNCED,
        lastSyncedAt: new Date(),
        syncError: null
      });
      mockPrisma.calendarIntegration.update.mockResolvedValue(integration);

      const result = await service.syncEventToCalendar("user-1", "org-1", "event-1");
      expect(result.syncStatus).toBe(CalendarSyncStatus.SYNCED);
      expect(mockGoogleClient.updateEvent).toHaveBeenCalledWith(
        "access-123",
        "primary",
        "google-event-1",
        expect.any(Object)
      );
    });

    it("throws when no integration found", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(null);

      await expect(
        service.syncEventToCalendar("user-1", "org-1", "event-1")
      ).rejects.toThrow(BadRequestException);
    });

    it("throws when event not found", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(integration);
      mockPrisma.event.findFirst.mockResolvedValue(null);

      await expect(
        service.syncEventToCalendar("user-1", "org-1", "event-1")
      ).rejects.toThrow(NotFoundException);
    });

    it("throws when syncing archived event", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(integration);
      mockPrisma.event.findFirst.mockResolvedValue({ ...event, status: EventStatus.ARCHIVED });

      await expect(
        service.syncEventToCalendar("user-1", "org-1", "event-1")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("disconnect", () => {
    it("stops webhook and deletes integration", async () => {
      const integration = {
        id: "int-1",
        userId: "user-1",
        organizationId: "org-1",
        webhookChannelId: "channel-1",
        webhookResourceId: "resource-1",
        accessToken: "access-123",
        refreshToken: "refresh-123",
        tokenExpiresAt: new Date(Date.now() + 3600_000)
      };
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(integration);
      mockPrisma.calendarIntegration.findUniqueOrThrow.mockResolvedValue(integration);
      mockGoogleClient.stopWatching.mockResolvedValue(undefined);
      mockPrisma.calendarIntegration.delete.mockResolvedValue(integration);

      await service.disconnect("user-1", "org-1", "int-1");
      expect(mockGoogleClient.stopWatching).toHaveBeenCalledWith("access-123", "channel-1", "resource-1");
      expect(mockPrisma.calendarIntegration.delete).toHaveBeenCalledWith({ where: { id: "int-1" } });
    });

    it("throws when integration not found", async () => {
      mockPrisma.calendarIntegration.findFirst.mockResolvedValue(null);

      await expect(
        service.disconnect("user-1", "org-1", "non-existent")
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("listIntegrations", () => {
    it("returns all integrations for user in org", async () => {
      mockPrisma.calendarIntegration.findMany.mockResolvedValue([
        {
          id: "int-1",
          provider: CalendarProvider.GOOGLE,
          calendarId: "primary",
          enabled: true,
          lastSyncAt: null,
          createdAt: new Date()
        }
      ]);

      const result = await service.listIntegrations("user-1", "org-1");
      expect(result).toHaveLength(1);
      expect(result[0].provider).toBe(CalendarProvider.GOOGLE);
    });
  });
});
