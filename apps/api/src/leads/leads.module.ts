import { Module } from "@nestjs/common";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../notifications/mail.module";
import { LeadsController } from "./leads.controller";
import { LeadsService } from "./leads.service";
import { LeadWhatsAppService } from "./lead-whatsapp.service";

@Module({
  imports: [PrismaModule, MailModule],
  controllers: [LeadsController],
  providers: [LeadsService, LeadWhatsAppService]
})
export class LeadsModule {}
