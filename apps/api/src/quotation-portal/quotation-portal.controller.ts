import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import {
  CreateQuotationPublicLinkDto,
  RequestQuotationChangesDto
} from "./dto/quotation-portal.dto";
import { QuotationPortalService } from "./quotation-portal.service";

@ApiTags("quotation-portal-admin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/quotations/:quotationId/public-link")
export class QuotationPortalAdminController {
  constructor(private readonly portal: QuotationPortalService) {}

  @Post()
  @RequirePermissions("quotations.send")
  @ApiOperation({ summary: "Crear un enlace público seguro para la cotización" })
  @ApiCreatedResponse()
  create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateQuotationPublicLinkDto
  ) {
    return this.portal.createLink(organizationId, quotationId, request.user.sub, dto);
  }

  @Delete()
  @RequirePermissions("quotations.send")
  @ApiOperation({ summary: "Revocar los enlaces públicos activos" })
  @ApiOkResponse()
  revoke(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string
  ) {
    return this.portal.revokeLink(organizationId, quotationId);
  }
}

// ThrottlerGuard is already registered globally as APP_GUARD (see
// security/distributed-throttling.module.ts) — applying it again here via
// @UseGuards would run canActivate() twice per request and silently halve
// the @Throttle limits below.
@ApiTags("quotation-portal")
@Controller("portal/quotations/:publicToken")
export class PublicQuotationPortalController {
  constructor(private readonly portal: QuotationPortalService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Header("Referrer-Policy", "no-referrer")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Ver una cotización mediante enlace público" })
  view(@Param("publicToken") token: string) {
    return this.portal.view(token);
  }

  @Post("change-requests")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header("Referrer-Policy", "no-referrer")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Solicitar cambios a la cotización" })
  requestChanges(
    @Param("publicToken") token: string,
    @Body() dto: RequestQuotationChangesDto
  ) {
    return this.portal.requestChanges(token, dto);
  }

  @Post("approve")
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header("Referrer-Policy", "no-referrer")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Aprobar la cotización desde el portal" })
  approve(@Param("publicToken") token: string) {
    return this.portal.approve(token);
  }
}
