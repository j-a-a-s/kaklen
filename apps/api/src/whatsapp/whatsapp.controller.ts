import { Body, Controller, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { PrepareWhatsAppNotificationDto } from "./dto/whatsapp.dto";
import { WhatsAppNotificationService } from "./whatsapp-notification.service";

@ApiTags("whatsapp-notifications")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/quotations/:quotationId/whatsapp")
export class WhatsAppController {
  constructor(private readonly whatsapp: WhatsAppNotificationService) {}

  @Post("prepare")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.send")
  @ApiOperation({ summary: "Preparar o enviar una notificación de WhatsApp según la configuración" })
  @ApiOkResponse()
  prepare(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: PrepareWhatsAppNotificationDto
  ) {
    return this.whatsapp.prepare(organizationId, quotationId, request.user.sub, dto);
  }
}
