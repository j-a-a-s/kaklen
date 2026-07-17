import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { MailModule } from "../notifications/mail.module";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";
import { QuotationDocumentService } from "./quotation-document.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule, MailModule],
  controllers: [QuotationsController],
  providers: [QuotationsService, QuotationDocumentService]
})
export class QuotationsModule {}
