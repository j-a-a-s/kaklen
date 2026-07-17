import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { ListNotificationsQueryDto } from "./dto/notification.dto";
import { InAppNotificationsService } from "./in-app-notifications.service";

@ApiTags("in-app-notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/notifications")
export class InAppNotificationsController {
  constructor(private readonly notifications: InAppNotificationsService) {}

  @Get()
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Listar notificaciones internas" })
  @ApiOkResponse()
  list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Query() query: ListNotificationsQueryDto
  ) {
    return this.notifications.list(organizationId, request.user.sub, query.limit);
  }

  @Get("unread-count")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Contar notificaciones no leídas" })
  unreadCount(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest
  ) {
    return this.notifications.unreadCount(organizationId, request.user.sub);
  }

  @Patch("read-all")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Marcar todas las notificaciones como leídas" })
  markAllRead(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest
  ) {
    return this.notifications.markAllRead(organizationId, request.user.sub);
  }

  @Patch(":notificationId/read")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Marcar una notificación como leída" })
  markRead(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("notificationId", new ParseUUIDPipe()) notificationId: string,
    @Req() request: OrganizationRequest
  ) {
    return this.notifications.markRead(organizationId, request.user.sub, notificationId);
  }
}
