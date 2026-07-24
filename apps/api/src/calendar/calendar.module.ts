import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { PrismaModule } from "../prisma/prisma.module";
import { CalendarController, CalendarWebhookController } from "./calendar.controller";
import { CalendarService } from "./calendar.service";
import { GoogleCalendarClient } from "./google-calendar.client";

@Module({
  imports: [PrismaModule, AuthModule, OrganizationsModule],
  controllers: [CalendarController, CalendarWebhookController],
  providers: [CalendarService, GoogleCalendarClient],
  exports: [CalendarService]
})
export class CalendarModule {}
