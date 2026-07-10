import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { OrganizationAccessGuard } from "./organization-access.guard";
import type { OrganizationRequest } from "./organization.types";
import { RequirePermissions } from "./require-permissions.decorator";
import { OrganizationsService } from "./organizations.service";
import {
  CreateOrganizationDto,
  InviteMemberDto,
  OrganizationInvitationDto,
  OrganizationMemberDto,
  OrganizationResponseDto,
  PermissionsResponseDto,
  UpdateMembershipDto,
  UpdateOrganizationDto
} from "./dto/organization.dto";

@ApiTags("organizations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organizations")
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @ApiOperation({ summary: "Crear una organización" })
  @ApiCreatedResponse({ type: OrganizationResponseDto })
  create(@Req() request: AuthenticatedRequest, @Body() dto: CreateOrganizationDto): Promise<OrganizationResponseDto> {
    return this.organizationsService.create(request.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: "Listar organizaciones propias" })
  @ApiOkResponse({ type: OrganizationResponseDto, isArray: true })
  list(@Req() request: AuthenticatedRequest): Promise<OrganizationResponseDto[]> {
    return this.organizationsService.list(request.user.sub);
  }

  @Get(":organizationId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.read")
  @ApiOkResponse({ type: OrganizationResponseDto })
  get(@Param("organizationId") organizationId: string): Promise<OrganizationResponseDto> {
    return this.organizationsService.get(organizationId);
  }

  @Patch(":organizationId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.update")
  @ApiOkResponse({ type: OrganizationResponseDto })
  update(
    @Param("organizationId") organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdateOrganizationDto
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.update(organizationId, request.user.sub, dto);
  }

  @Get(":organizationId/members")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.read")
  @ApiOkResponse({ type: OrganizationMemberDto, isArray: true })
  members(@Param("organizationId") organizationId: string): Promise<OrganizationMemberDto[]> {
    return this.organizationsService.members(organizationId);
  }

  @Patch(":organizationId/members/:membershipId")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.update")
  @ApiOkResponse({ type: OrganizationMemberDto })
  updateMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() request: OrganizationRequest,
    @Body() dto: UpdateMembershipDto
  ): Promise<OrganizationMemberDto> {
    return this.organizationsService.updateMember(
      organizationId,
      membershipId,
      this.requireMembership(request),
      dto
    );
  }

  @Delete(":organizationId/members/:membershipId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.remove")
  @ApiNoContentResponse()
  removeMember(
    @Param("organizationId") organizationId: string,
    @Param("membershipId") membershipId: string,
    @Req() request: OrganizationRequest
  ): Promise<void> {
    return this.organizationsService.removeMember(
      organizationId,
      membershipId,
      this.requireMembership(request)
    );
  }

  @Post(":organizationId/invitations")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.invite")
  @ApiCreatedResponse({ type: OrganizationInvitationDto })
  invite(
    @Param("organizationId") organizationId: string,
    @Req() request: AuthenticatedRequest,
    @Body() dto: InviteMemberDto
  ): Promise<OrganizationInvitationDto> {
    return this.organizationsService.invite(organizationId, request.user.sub, dto);
  }

  @Get(":organizationId/invitations")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.invite")
  @ApiOkResponse({ type: OrganizationInvitationDto, isArray: true })
  invitations(@Param("organizationId") organizationId: string): Promise<OrganizationInvitationDto[]> {
    return this.organizationsService.invitations(organizationId);
  }

  @Delete(":organizationId/invitations/:invitationId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.members.invite")
  @ApiNoContentResponse()
  revokeInvitation(
    @Param("organizationId") organizationId: string,
    @Param("invitationId") invitationId: string,
    @Req() request: AuthenticatedRequest
  ): Promise<void> {
    return this.organizationsService.revokeInvitation(organizationId, invitationId, request.user.sub);
  }

  @Get(":organizationId/me/permissions")
  @UseGuards(OrganizationAccessGuard)
  @RequirePermissions("organization.read")
  @ApiOkResponse({ type: PermissionsResponseDto })
  permissions(@Req() request: OrganizationRequest): PermissionsResponseDto {
    return {
      permissions: this.organizationsService.permissionsForMembership(this.requireMembership(request))
    };
  }

  private requireMembership(request: OrganizationRequest) {
    if (!request.organizationMembership) {
      throw new Error("Organization membership was not loaded");
    }

    return request.organizationMembership;
  }
}
