import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import type { AuthenticatedRequest } from "../auth/auth.types";
import { AcceptInvitationDto, OrganizationResponseDto } from "./dto/organization.dto";
import { OrganizationsService } from "./organizations.service";

@ApiTags("organization-invitations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("organization-invitations")
export class OrganizationInvitationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post("accept")
  @ApiOkResponse({ type: OrganizationResponseDto })
  accept(
    @Req() request: AuthenticatedRequest,
    @Body() dto: AcceptInvitationDto
  ): Promise<OrganizationResponseDto> {
    return this.organizationsService.acceptInvitation(request.user.sub, dto);
  }
}
