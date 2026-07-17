import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { OrganizationAccessGuard } from "../organizations/organization-access.guard";
import { RequirePermissions } from "../organizations/require-permissions.decorator";
import {
  CompleteSandboxPaymentDto,
  CreatePublicPaymentDto,
  RefundPaymentDto,
  SandboxWebhookDto
} from "./dto/payment.dto";
import { PaymentsService } from "./payments.service";

@ApiTags("public-payments")
@UseGuards(ThrottlerGuard)
@Controller()
export class PublicPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post("portal/quotations/:publicToken/payments")
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Crear un intento de pago sandbox idempotente" })
  create(@Param("publicToken") publicToken: string, @Body() dto: CreatePublicPaymentDto) {
    return this.payments.createPublicIntent(publicToken, dto);
  }

  @Get("portal/payments/checkout/:checkoutToken")
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  checkout(@Param("checkoutToken") checkoutToken: string) {
    return this.payments.checkout(checkoutToken);
  }

  @Post("portal/payments/checkout/:checkoutToken/complete")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  complete(
    @Param("checkoutToken") checkoutToken: string,
    @Body() dto: CompleteSandboxPaymentDto
  ) {
    return this.payments.completeSandbox(checkoutToken, dto);
  }

  @Post("payments/webhooks/sandbox")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  webhook(
    @Body() dto: SandboxWebhookDto,
    @Headers("x-sandbox-signature") signature = ""
  ) {
    return this.payments.processWebhook(dto, signature);
  }
}

@ApiTags("payments")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, OrganizationAccessGuard)
@Controller("organizations/:organizationId/payments")
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get(":paymentId")
  @RequirePermissions("wallet.read")
  @ApiOkResponse()
  get(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string
  ) {
    return this.payments.get(organizationId, paymentId);
  }

  @Post(":paymentId/cancel")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("wallet.manage")
  cancel(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string
  ) {
    return this.payments.cancel(organizationId, paymentId);
  }

  @Post(":paymentId/refunds")
  @HttpCode(HttpStatus.OK)
  @RequirePermissions("wallet.manage")
  refund(
    @Param("organizationId", new ParseUUIDPipe()) organizationId: string,
    @Param("paymentId", new ParseUUIDPipe()) paymentId: string,
    @Body() dto: RefundPaymentDto
  ) {
    return this.payments.refund(organizationId, paymentId, dto);
  }
}
