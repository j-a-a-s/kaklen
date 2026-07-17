import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "../auth/auth.module";
import { InAppNotificationsModule } from "../in-app-notifications/in-app-notifications.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { QuotationPortalModule } from "../quotation-portal/quotation-portal.module";
import { PAYMENT_GATEWAY } from "./payment-gateway";
import { PaymentsController, PublicPaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    QuotationPortalModule,
    InAppNotificationsModule,
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }])
  ],
  controllers: [PublicPaymentsController, PaymentsController],
  providers: [
    SandboxPaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: SandboxPaymentGateway },
    PaymentsService
  ],
  exports: [PaymentsService]
})
export class PaymentsModule {}
