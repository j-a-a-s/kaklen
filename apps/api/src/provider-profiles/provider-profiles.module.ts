import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { QuotationPortalModule } from "../quotation-portal/quotation-portal.module";
import { ProviderProfilesController, PublicProviderProfilesController } from "./provider-profiles.controller";
import { ProviderProfilesService } from "./provider-profiles.service";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    QuotationPortalModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])
  ],
  controllers: [PublicProviderProfilesController, ProviderProfilesController],
  providers: [ProviderProfilesService]
})
export class ProviderProfilesModule {}
