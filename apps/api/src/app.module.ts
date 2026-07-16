import { Module } from "@nestjs/common";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./auth/auth.module";
import { OrganizationsModule } from "./organizations/organizations.module";
import { ClientsModule } from "./clients/clients.module";
import { CatalogModule } from "./catalog/catalog.module";
import { QuotationsModule } from "./quotations/quotations.module";
import { EventsModule } from "./events/events.module";
import { StorageModule } from "./storage/storage.module";
import { AssistantModule } from "./assistant/assistant.module";

@Module({
  imports: [HealthModule, PrismaModule, AuthModule, OrganizationsModule, ClientsModule, CatalogModule, QuotationsModule, EventsModule, StorageModule, AssistantModule]
})
export class AppModule {}
