import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { InAppNotificationsController } from "./in-app-notifications.controller";
import { InAppNotificationsService } from "./in-app-notifications.service";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [InAppNotificationsController],
  providers: [InAppNotificationsService],
  exports: [InAppNotificationsService]
})
export class InAppNotificationsModule {}
