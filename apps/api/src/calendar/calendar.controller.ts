import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { CalendarService } from "./calendar.service";
import { ConnectCalendarDto, SyncEventDto } from "./dto/calendar.dto";
import type { CalendarIntegrationView, CalendarSyncView } from "./calendar.types";

interface OrganizationRequest {
  user: { sub: string };
}

@ApiTags("Calendar")
@Controller("api/organizations/:organizationId/calendar")
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) {}

  @Get("auth-url")
  @ApiOperation({ summary: "Get Google Calendar OAuth authorization URL" })
  @RequirePermissions("events.create")
  getAuthUrl(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest
  ): { url: string } {
    const url = this.calendarService.getGoogleAuthUrl(request.user.sub, organizationId);
    return { url };
  }

  @Post("connect")
  @ApiOperation({ summary: "Connect Google Calendar using OAuth authorization code" })
  @RequirePermissions("events.create")
  async connect(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: ConnectCalendarDto
  ): Promise<CalendarIntegrationView> {
    return this.calendarService.connectGoogle(
      request.user.sub,
      organizationId,
      dto.code,
      dto.calendarId
    );
  }

  @Delete(":integrationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect a calendar integration" })
  @RequirePermissions("events.create")
  async disconnect(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("integrationId", new ParseUUIDPipe()) integrationId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    await this.calendarService.disconnect(request.user.sub, organizationId, integrationId);
  }

  @Get("integrations")
  @ApiOperation({ summary: "List calendar integrations for current user" })
  @RequirePermissions("events.read")
  async listIntegrations(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest
  ): Promise<CalendarIntegrationView[]> {
    return this.calendarService.listIntegrations(request.user.sub, organizationId);
  }

  @Post("sync")
  @ApiOperation({ summary: "Sync an event to Google Calendar" })
  @RequirePermissions("events.update")
  async syncEvent(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: SyncEventDto
  ): Promise<CalendarSyncView> {
    return this.calendarService.syncEventToCalendar(
      request.user.sub,
      organizationId,
      dto.eventId
    );
  }

  @Delete("sync/:eventId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove event from synced Google Calendar" })
  @RequirePermissions("events.update")
  async unsyncEvent(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("eventId", new ParseUUIDPipe()) eventId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    await this.calendarService.deleteEventFromCalendar(
      request.user.sub,
      organizationId,
      eventId
    );
  }
}

@ApiTags("Calendar Webhooks")
@Controller("api/calendar")
export class CalendarWebhookController {
  constructor(private readonly calendarService: CalendarService) {}

  @Post("webhook")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Google Calendar push notification webhook" })
  async handleWebhook(
    @Headers("x-goog-channel-id") channelId: string,
    @Headers("x-goog-resource-id") resourceId: string
  ): Promise<void> {
    if (!channelId || !resourceId) {
      return;
    }
    await this.calendarService.handleWebhook(channelId, resourceId);
  }
}
