import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags
} from "@nestjs/swagger";
import type { Response } from "express";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import type { OrganizationRequest } from "../organizations/organization.types";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import {
  ChangeQuotationStatusDto,
  CreateQuotationDto,
  ListQuotationsQueryDto,
  SendQuotationEmailDto,
  UpdateQuotationDto
} from "./dto/quotation.dto";
import { PaginatedQuotations, QuotationSummary, QuotationsService } from "./quotations.service";

@ApiTags("quotations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/quotations")
export class QuotationsController {
  constructor(private readonly quotationsService: QuotationsService) {}

  @Post()
  @RequirePermissions("quotations.create")
  @ApiOperation({ summary: "Create quotation", description: "Requires quotations.create." })
  @ApiParam({ name: "organizationId", format: "uuid" })
  @ApiCreatedResponse()
  create(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: CreateQuotationDto
  ) {
    return this.quotationsService.create(organizationId, request.user.sub, dto);
  }

  @Get()
  @RequirePermissions("quotations.read")
  @ApiOperation({ summary: "List quotations", description: "Requires quotations.read." })
  @ApiOkResponse()
  list(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Query() query: ListQuotationsQueryDto
  ): Promise<PaginatedQuotations> {
    return this.quotationsService.list(organizationId, query);
  }

  @Get("summary")
  @RequirePermissions("quotations.read")
  @ApiOperation({ summary: "Quotation summary", description: "Requires quotations.read." })
  @ApiOkResponse()
  summary(@Param("organizationId", new ParseUUIDPipe()) organizationId: string): Promise<QuotationSummary> {
    return this.quotationsService.summary(organizationId);
  }

  @Get(":quotationId")
  @RequirePermissions("quotations.read")
  @ApiOperation({ summary: "Get quotation", description: "Requires quotations.read." })
  @ApiOkResponse()
  get(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string
  ) {
    return this.quotationsService.get(organizationId, quotationId);
  }

  @Patch(":quotationId")
  @RequirePermissions("quotations.update")
  @ApiOperation({ summary: "Update quotation", description: "Requires quotations.update. Only DRAFT can be edited." })
  @ApiOkResponse()
  update(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: UpdateQuotationDto
  ) {
    return this.quotationsService.update(organizationId, quotationId, request.user.sub, dto);
  }

  @Delete(":quotationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions("quotations.delete")
  @ApiOperation({ summary: "Archive quotation", description: "Requires quotations.delete." })
  @ApiNoContentResponse()
  archive(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    return this.quotationsService.archive(organizationId, quotationId, request.user.sub);
  }

  @Post(":quotationId/send")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.send")
  @ApiOkResponse()
  send(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: ChangeQuotationStatusDto
  ) {
    return this.quotationsService.send(organizationId, quotationId, request.user.sub, dto);
  }

  @Post(":quotationId/approve")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.approve")
  @ApiOkResponse()
  approve(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: ChangeQuotationStatusDto
  ) {
    return this.quotationsService.approve(organizationId, quotationId, request.user.sub, dto);
  }

  @Post(":quotationId/reject")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.reject")
  @ApiOkResponse()
  reject(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: ChangeQuotationStatusDto
  ) {
    return this.quotationsService.reject(organizationId, quotationId, request.user.sub, dto);
  }

  @Post(":quotationId/cancel")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.send")
  @ApiOkResponse()
  cancel(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: ChangeQuotationStatusDto
  ) {
    return this.quotationsService.cancel(organizationId, quotationId, request.user.sub, dto);
  }

  @Post(":quotationId/new-version")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.update")
  @ApiOkResponse()
  newVersion(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest
  ) {
    return this.quotationsService.newVersion(organizationId, quotationId, request.user.sub);
  }

  @Get(":quotationId/history")
  @RequirePermissions("quotations.read")
  @ApiOkResponse()
  history(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string
  ) {
    return this.quotationsService.history(organizationId, quotationId);
  }

  @Get(":quotationId/pdf")
  @RequirePermissions("quotations.read")
  @Header("Content-Type", "application/pdf")
  @ApiProduces("application/pdf")
  @ApiOkResponse({ description: "Quotation PDF" })
  async pdf(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Query("locale") locale: string | undefined,
    @Res() response: Response
  ): Promise<void> {
    const document = await this.quotationsService.pdfDocument(organizationId, quotationId, locale ?? "es");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `attachment; filename="${document.filename}"`);
    response.send(document.buffer);
  }

  @Post(":quotationId/email")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("quotations.send")
  @ApiOperation({ summary: "Send quotation by email", description: "Sends the generated PDF and changes a draft quotation to SENT only after SMTP succeeds." })
  @ApiOkResponse()
  sendEmail(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("quotationId", new ParseUUIDPipe()) quotationId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: SendQuotationEmailDto
  ) {
    return this.quotationsService.sendEmail(organizationId, quotationId, request.user.sub, dto);
  }
}
