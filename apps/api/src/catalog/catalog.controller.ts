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
import { CatalogItem } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { CatalogService, PaginatedCatalogItems } from "./catalog.service";
import { CreateCatalogItemDto, ListCatalogItemsQueryDto, UpdateCatalogItemDto } from "./dto/catalog.dto";

@ApiTags("catalog")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/catalog")
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Post()
  @RequirePermissions("catalog.create")
  @ApiOperation({ summary: "Crear item de catalogo", description: "Requiere permiso catalog.create." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiCreatedResponse()
  create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateCatalogItemDto
  ): Promise<CatalogItem> {
    return this.catalogService.create(organizationId, request.user.sub, dto);
  }

  @Get()
  @RequirePermissions("catalog.read")
  @ApiOperation({ summary: "Listar catalogo", description: "Requiere permiso catalog.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiQuery({ name: "search", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "sku", required: false })
  @ApiQuery({ name: "code", required: false })
  @ApiQuery({ name: "minPrice", required: false })
  @ApiQuery({ name: "maxPrice", required: false })
  @ApiQuery({ name: "page", required: false, example: 1 })
  @ApiQuery({ name: "pageSize", required: false, example: 20 })
  @ApiQuery({ name: "includeArchived", required: false, example: false })
  @ApiOkResponse()
  list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: ListCatalogItemsQueryDto
  ): Promise<PaginatedCatalogItems> {
    return this.catalogService.list(organizationId, query);
  }

  @Get("search")
  @RequirePermissions("catalog.read")
  @ApiOperation({ summary: "Buscar catalogo", description: "Alias de listado con filtros. Requiere catalog.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiOkResponse()
  search(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: ListCatalogItemsQueryDto
  ): Promise<PaginatedCatalogItems> {
    return this.catalogService.list(organizationId, query);
  }

  @Get(":itemId")
  @RequirePermissions("catalog.read")
  @ApiOperation({ summary: "Obtener item de catalogo", description: "Requiere permiso catalog.read." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "itemId", format: "uuid" })
  @ApiOkResponse()
  get(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string
  ): Promise<CatalogItem> {
    return this.catalogService.get(organizationId, itemId);
  }

  @Patch(":itemId")
  @RequirePermissions("catalog.update")
  @ApiOperation({ summary: "Actualizar item de catalogo", description: "Requiere permiso catalog.update." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "itemId", format: "uuid" })
  @ApiOkResponse()
  update(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: UpdateCatalogItemDto
  ): Promise<CatalogItem> {
    return this.catalogService.update(organizationId, itemId, request.user.sub, dto);
  }

  @Delete(":itemId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("catalog.delete")
  @ApiOperation({ summary: "Archivar item de catalogo", description: "Requiere permiso catalog.delete." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiParam({ name: "itemId", format: "uuid" })
  @ApiNoContentResponse()
  archive(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("itemId", new ParseUUIDPipe()) itemId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    return this.catalogService.archive(organizationId, itemId, request.user.sub);
  }
}
