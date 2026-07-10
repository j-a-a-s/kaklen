import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { QuotationsController } from "./quotations.controller";
import { QuotationsService } from "./quotations.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [QuotationsController],
  providers: [QuotationsService]
})
export class QuotationsModule {}
