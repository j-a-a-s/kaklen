import { Module } from "@nestjs/common";
import { OrganizationsController } from "./organizations.controller";
import { OrganizationInvitationsController } from "./organization-invitations.controller";
import { OrganizationsService } from "./organizations.service";
import { OrganizationAccessGuard } from "./organization-access.guard";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [OrganizationsController, OrganizationInvitationsController],
  providers: [OrganizationsService, OrganizationAccessGuard],
  exports: [OrganizationsService]
})
export class OrganizationsModule {}
