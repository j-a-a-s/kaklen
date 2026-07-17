import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "../auth/auth.module";
import { InAppNotificationsModule } from "../in-app-notifications/in-app-notifications.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import {
  PublicQuotationPortalController,
  QuotationPortalAdminController
} from "./quotation-portal.controller";
import { QuotationPortalService } from "./quotation-portal.service";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    InAppNotificationsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])
  ],
  controllers: [QuotationPortalAdminController, PublicQuotationPortalController],
  providers: [QuotationPortalService],
  exports: [QuotationPortalService]
})
export class QuotationPortalModule {}
