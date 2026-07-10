import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [CatalogController],
  providers: [CatalogService]
})
export class CatalogModule {}
