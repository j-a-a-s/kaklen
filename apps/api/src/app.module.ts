import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";

@Module({
  imports: [HealthModule, PrismaModule, AuthModule, OrganizationsModule]
})
export class AppModule {}
