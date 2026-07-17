import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { WhatsAppNotificationService } from "./whatsapp-notification.service";
import { WhatsAppController } from "./whatsapp.controller";

@Module({
  imports: [AuthModule, OrganizationsModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppNotificationService],
  exports: [WhatsAppNotificationService]
})
export class WhatsAppModule {}
