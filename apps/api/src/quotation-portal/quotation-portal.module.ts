import { Module } from "@nestjs/common";
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
    InAppNotificationsModule
  ],
  controllers: [QuotationPortalAdminController, PublicQuotationPortalController],
  providers: [QuotationPortalService],
  exports: [QuotationPortalService]
})
export class QuotationPortalModule {}
