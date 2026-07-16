import { Controller, Get, Param, ParseUUIDPipe, Query, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { AssistantService } from "./assistant.service";
import { ActivityQueryDto, GlobalSearchQueryDto } from "./dto/assistant.dto";
import { UserActivationService } from "./user-activation.service";

@ApiTags("assistant")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/assistant")
export class AssistantController {
  constructor(
    private readonly assistantService: AssistantService,
    private readonly activationService: UserActivationService
  ) {}

  @Get("activation")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Calcular activación derivada de la organización" })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiOkResponse()
  activation(@Param("organizationId", new ParseUUIDPipe()) organizationId: string) {
    return this.activationService.calculate(organizationId);
  }

  @Get("dashboard")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Obtener resumen operativo asistido" })
  @ApiOkResponse()
  dashboard(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Req() request: OrganizationRequest) {
    return this.assistantService.dashboard(organizationId, request.organizationMembership!.role);
  }

  @Get("search")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Buscar recursos del tenant respetando RBAC" })
  @ApiOkResponse()
  search(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Req() request: OrganizationRequest, @Query() query: GlobalSearchQueryDto) {
    return this.assistantService.search(organizationId, request.organizationMembership!.role, query.query, query.limit);
  }

  @Get("activity")
  @RequirePermissions("organization.read")
  @ApiOperation({ summary: "Listar actividad reciente de la organización" })
  @ApiOkResponse()
  activity(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Req() request: OrganizationRequest, @Query() query: ActivityQueryDto) {
    return this.assistantService.activity(organizationId, request.organizationMembership!.role, query.limit);
  }

  @Get("clients/:clientId/timeline")
  @RequirePermissions("clients.read")
  @ApiOperation({ summary: "Obtener timeline unificado del cliente" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiOkResponse()
  timeline(@Param("organizationId", new ParseUUIDPipe()) organizationId: string, @Param("clientId", new ParseUUIDPipe()) clientId: string) {
    return this.assistantService.clientTimeline(organizationId, clientId);
  }
}
