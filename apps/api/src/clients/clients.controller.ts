import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags
} from "@nestjs/swagger";
import { Client, ClientInteraction } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { ClientsService, ClientSummary, PaginatedResponse } from "./clients.service";
import { CreateClientDto, CreateClientInteractionDto, ListClientsQueryDto, UpdateClientDto } from "./dto/client.dto";

@ApiTags("clients")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/clients")
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Post()
  @RequirePermissions("clients.create")
  @ApiOperation({ summary: "Crear cliente", description: "Requiere permiso clients.create." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiCreatedResponse()
  create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateClientDto
  ): Promise<Client> {
    return this.clientsService.create(organizationId, request.user.sub, dto);
  }

  @Get()
  @RequirePermissions("clients.read")
  @ApiOperation({ summary: "Listar clientes", description: "Requiere permiso clients.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "city", required: false })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 20 })
  @ApiQuery({ name: "includeArchived", required: false, example: false })
  @ApiOkResponse()
  list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: ListClientsQueryDto
  ): Promise<PaginatedResponse<Client>> {
    return this.clientsService.list(organizationId, query);
  }

  @Get("summary")
  @RequirePermissions("clients.read")
  @ApiOperation({ summary: "Resumen de clientes", description: "Requiere permiso clients.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiOkResponse()
  summary(@Param("organizationId", new ParseUUIDPipe()) organizationId: string): Promise<ClientSummary> {
    return this.clientsService.summary(organizationId);
  }

  @Get(":clientId")
  @RequirePermissions("clients.read")
  @ApiOperation({ summary: "Obtener cliente", description: "Requiere permiso clients.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiOkResponse()
  get(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("clientId", new ParseUUIDPipe()) clientId: string
  ): Promise<Client> {
    return this.clientsService.get(organizationId, clientId);
  }

  @Patch(":clientId")
  @RequirePermissions("clients.update")
  @ApiOperation({ summary: "Actualizar cliente", description: "Requiere permiso clients.update." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiOkResponse()
  update(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("clientId", new ParseUUIDPipe()) clientId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: UpdateClientDto
  ): Promise<Client> {
    return this.clientsService.update(organizationId, clientId, request.user.sub, dto);
  }

  @Delete(":clientId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("clients.delete")
  @ApiOperation({ summary: "Archivar cliente", description: "Requiere permiso clients.delete." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiNoContentResponse()
  archive(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("clientId", new ParseUUIDPipe()) clientId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    return this.clientsService.archive(organizationId, clientId, request.user.sub);
  }

  @Post(":clientId/interactions")
  @RequirePermissions("clients.update")
  @ApiOperation({ summary: "Crear interacción", description: "Requiere permiso clients.update." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiCreatedResponse()
  createInteraction(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("clientId", new ParseUUIDPipe()) clientId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateClientInteractionDto
  ): Promise<ClientInteraction> {
    return this.clientsService.createInteraction(organizationId, clientId, request.user.sub, dto);
  }

  @Get(":clientId/interactions")
  @RequirePermissions("clients.read")
  @ApiOperation({ summary: "Listar interacciones", description: "Requiere permiso clients.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "clientId", format: "uuid" })
  @ApiOkResponse()
  interactions(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("clientId", new ParseUUIDPipe()) clientId: string
  ): Promise<ClientInteraction[]> {
    return this.clientsService.interactions(organizationId, clientId);
  }
}
