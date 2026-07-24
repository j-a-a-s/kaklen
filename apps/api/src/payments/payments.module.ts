import { Module } from "@nestjs/common";
import { readProductIntegrationsConfig } from "@kaklen/config";
import { AuthModule } from "../auth/auth.module";
import { InAppNotificationsModule } from "../in-app-notifications/in-app-notifications.module";
import { OrganizationsModule } from "../organizations/organizations.module";
import { QuotationPortalModule } from "../quotation-portal/quotation-portal.module";
import { PAYMENT_GATEWAY, resolvePaymentGateway } from "./payment-gateway";
import { PaymentsController, PublicPaymentsController } from "./payments.controller";
import { PaymentsService } from "./payments.service";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";

@Module({
  imports: [
    AuthModule,
    OrganizationsModule,
    QuotationPortalModule,
    InAppNotificationsModule
  ],
  controllers: [PublicPaymentsController, PaymentsController],
  providers: [
    SandboxPaymentGateway,
    {
      provide: PAYMENT_GATEWAY,
      // Evaluated eagerly during module instantiation, so a throw here
      // (PAYMENT_GATEWAY=provider with no adapter registered) aborts
      // application bootstrap instead of surfacing per-request.
      useFactory: (sandboxGateway: SandboxPaymentGateway) =>
        resolvePaymentGateway(readProductIntegrationsConfig(process.env).paymentGateway, sandboxGateway),
      inject: [SandboxPaymentGateway]
    },
    PaymentsService
  ],
  exports: [PaymentsService]
})
export class PaymentsModule {}
