import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { QuotationPortalModule } from "../quotation-portal/quotation-portal.module";
import { ProviderProfilesController, PublicProviderProfilesController } from "./provider-profiles.controller";
import { ProviderProfilesService } from "./provider-profiles.service";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    QuotationPortalModule
  ],
  controllers: [PublicProviderProfilesController, ProviderProfilesController],
  providers: [ProviderProfilesService]
})
export class ProviderProfilesModule {}
