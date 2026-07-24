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
import { InAppNotificationsModule } from "./in-app-notifications/in-app-notifications.module";
import { QuotationPortalModule } from "./quotation-portal/quotation-portal.module";
import { WhatsAppModule } from "./whatsapp/whatsapp.module";
import { PaymentsModule } from "./payments/payments.module";
import { ProviderProfilesModule } from "./provider-profiles/provider-profiles.module";
import { DistributedThrottlingModule } from "./security/distributed-throttling.module";
import { LeadsModule } from "./leads/leads.module";
import { CalendarModule } from "./calendar/calendar.module";

@Module({
  imports: [
    DistributedThrottlingModule,
    HealthModule,
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ClientsModule,
    CatalogModule,
    QuotationsModule,
    EventsModule,
    StorageModule,
    AssistantModule,
    InAppNotificationsModule,
    QuotationPortalModule,
    WhatsAppModule,
    PaymentsModule,
    ProviderProfilesModule,
    LeadsModule,
    CalendarModule
  ]
})
export class AppModule {}
