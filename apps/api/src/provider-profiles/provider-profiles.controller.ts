import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import { CreateProviderProfileDto, ReviewProviderProfileDto } from "./dto/provider-profile.dto";
import { ProviderProfilesService } from "./provider-profiles.service";

@ApiTags("public-provider-profiles")
@UseGuards(ThrottlerGuard)
@Controller("portal/quotations/:publicToken/provider-profile")
export class PublicProviderProfilesController {
  constructor(private readonly profiles: ProviderProfilesService) {}

  @Post("recommendation-view")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  recommendationShown(@Param("publicToken") publicToken: string) {
    return this.profiles.recommendationShown(publicToken);
  }

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Crear un perfil profesional con consentimiento explícito" })
  create(
    @Param("publicToken") publicToken: string,
    @Body() dto: CreateProviderProfileDto
  ) {
    return this.profiles.create(publicToken, dto);
  }
}

@ApiTags("provider-profiles")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/provider-profiles")
export class ProviderProfilesController {
  constructor(private readonly profiles: ProviderProfilesService) {}

  @Get()
  @RequirePermissions("organization.read")
  @ApiOkResponse()
  list(@Param("organizationId", new ParseUUIDPipe()) organizationId: string) {
    return this.profiles.list(organizationId);
  }

  @Patch(":profileId/review")
  @RequirePermissions("organization.update")
  review(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("profileId", new ParseUUIDPipe()) profileId: string,
    @Body() dto: ReviewProviderProfileDto
  ) {
    return this.profiles.review(organizationId, profileId, dto);
  }
}
