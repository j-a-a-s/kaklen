import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException
} from "@nestjs/common";
import {
  InAppNotificationType,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuotationStatus
} from "@prisma/client";
import { readPasswordRecoveryConfig } from "@kaklen/config";
import { createHash, randomBytes } from "node:crypto";
import { InAppNotificationsService } from "../in-app-notifications/in-app-notifications.service";
import { serializeMoney } from "../common/money-validation";
import { PrismaService } from "../prisma/prisma.service";
import { QuotationPortalService } from "../quotation-portal/quotation-portal.service";
import { calculateConsistentQuotationMoney } from "../quotations/quotation-money-consistency";
import { CompleteSandboxPaymentDto, CreatePublicPaymentDto, RefundPaymentDto } from "./dto/payment.dto";
import { PAYMENT_GATEWAY, PaymentGateway, PaymentWebhookPayload } from "./payment-gateway";

export interface PublicPaymentIntent {
  paymentId: string;
  status: PaymentStatus;
  checkoutUrl: string;
  amount: string;
  currency: string;
}

@Injectable()
export class PaymentsService {
  private readonly appPublicUrl = readPasswordRecoveryConfig(process.env).appPublicUrl;

  constructor(
    private readonly prisma: PrismaService,
    private readonly portal: QuotationPortalService,
    private readonly notifications: InAppNotificationsService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway
  ) {}

  async createPublicIntent(
    publicToken: string,
    dto: CreatePublicPaymentDto
  ): Promise<PublicPaymentIntent> {
    this.assertSandboxAvailable();
    const resolved = await this.portal.resolve(publicToken, true);
    const quotation = resolved.quotation;
    calculateConsistentQuotationMoney(quotation);
    if (
      quotation.status !== QuotationStatus.SENT &&
      quotation.status !== QuotationStatus.APPROVED
    ) {
      throw new BadRequestException({
        code: "PAYMENT_QUOTATION_NOT_PAYABLE",
        message: "Quotation is not available for payment"
      });
    }

    const existing = await this.prisma.payment.findUnique({
      where: {
        organizationId_idempotencyKey: {
          organizationId: quotation.organizationId,
          idempotencyKey: dto.idempotencyKey
        }
      }
    });
    if (existing) {
      if (existing.quotationId !== quotation.id) {
        throw new ConflictException({
          code: "PAYMENT_IDEMPOTENCY_CONFLICT",
          message: "Idempotency key belongs to another payment"
        });
      }
      return this.rotateCheckout(existing, dto.locale ?? "es");
    }

    const intent = await this.gateway.createPaymentIntent({
      amount: serializeMoney(quotation.total.toString(), quotation.currency),
      currency: quotation.currency,
      reference: `${quotation.number}-v${quotation.version}`
    });
    const now = new Date();
    let payment: Payment;
    try {
      payment = await this.prisma.$transaction(async (tx) => {
        if (quotation.status === QuotationStatus.SENT) {
          await tx.quotation.update({
            where: { id: quotation.id },
            data: { status: QuotationStatus.APPROVED, approvedAt: now }
          });
          await tx.quotationStatusHistory.create({
            data: {
              organizationId: quotation.organizationId,
              quotationId: quotation.id,
              previousStatus: quotation.status,
              newStatus: QuotationStatus.APPROVED,
              changedByUserId: null,
              note: "quotation.portal.approved"
            }
          });
        }
        return tx.payment.create({
          data: {
            organizationId: quotation.organizationId,
            quotationId: quotation.id,
            publicLinkId: resolved.link.id,
            provider: PaymentProvider.SANDBOX,
            status: PaymentStatus.PENDING,
            amount: quotation.total,
            currency: quotation.currency,
            idempotencyKey: dto.idempotencyKey,
            externalReference: intent.externalReference,
            checkoutTokenHash: hashCheckoutToken(intent.checkoutToken),
            attempts: {
              create: {
                status: PaymentStatus.PENDING,
                providerReference: intent.providerReference
              }
            }
          }
        });
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const concurrent = await this.prisma.payment.findUnique({
        where: {
          organizationId_idempotencyKey: {
            organizationId: quotation.organizationId,
            idempotencyKey: dto.idempotencyKey
          }
        }
      });
      if (!concurrent || concurrent.quotationId !== quotation.id) {
        throw new ConflictException({
          code: "PAYMENT_IDEMPOTENCY_CONFLICT",
          message: "Idempotency key belongs to another payment"
        });
      }
      return this.rotateCheckout(concurrent, dto.locale ?? "es");
    }

    if (quotation.status === QuotationStatus.SENT) {
      await this.notify(payment, InAppNotificationType.QUOTATION_APPROVED);
    }
    await this.notify(payment, InAppNotificationType.PAYMENT_STARTED);
    return this.intentResponse(payment, intent.checkoutToken, dto.locale ?? "es");
  }

  async checkout(checkoutToken: string) {
    const payment = await this.findByCheckoutToken(checkoutToken);
    return {
      payment: {
        status: payment.status,
        amount: serializeMoney(payment.amount.toString(), payment.currency),
        currency: payment.currency,
        createdAt: payment.createdAt
      },
      quotation: {
        number: payment.quotation.number,
        version: payment.quotation.version,
        clientName: payment.quotation.client.displayName
      },
      organization: { name: payment.organization.name },
      sandbox: true
    };
  }

  async completeSandbox(checkoutToken: string, dto: CompleteSandboxPaymentDto) {
    this.assertSandboxAvailable();
    const payment = await this.findByCheckoutToken(checkoutToken);
    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PROCESSING &&
      payment.status !== PaymentStatus.FAILED
    ) {
      return { status: payment.status };
    }
    const webhook = this.gateway.createSignedWebhook(
      payment.externalReference,
      dto.outcome,
      serializeMoney(payment.amount.toString(), payment.currency),
      payment.currency
    );
    return this.processWebhook(webhook.payload, webhook.signature);
  }

  async processWebhook(payload: PaymentWebhookPayload, signature: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { externalReference: payload.externalReference }
    });
    if (!payment) {
      throw new NotFoundException({ code: "PAYMENT_NOT_FOUND", message: "Payment not found" });
    }
    const signatureValid = this.gateway.verifyWebhookSignature(payload, signature);
    if (!signatureValid) {
      await this.recordWebhook(payment, payload, false, null);
      throw new UnauthorizedException({
        code: "PAYMENT_WEBHOOK_SIGNATURE_INVALID",
        message: "Webhook signature is invalid"
      });
    }
    const duplicate = await this.prisma.paymentWebhookEvent.findUnique({
      where: { providerEventId: payload.eventId }
    });
    if (duplicate) {
      const current = await this.prisma.payment.findUnique({ where: { id: payment.id } });
      return { status: current?.status ?? payment.status, duplicate: true };
    }
    const webhookCurrency = payload.currency.toUpperCase();
    const webhookAmount = serializeMoney(payload.amount, webhookCurrency);
    if (!payment.amount.equals(new Prisma.Decimal(webhookAmount)) || payment.currency !== webhookCurrency) {
      await this.recordWebhook(payment, payload, true, null);
      throw new BadRequestException({
        code: "PAYMENT_WEBHOOK_AMOUNT_MISMATCH",
        message: "Webhook amount or currency does not match the payment"
      });
    }

    const status = PaymentStatus[payload.status];
    let updated: Payment;
    try {
      updated = await this.prisma.$transaction(async (tx) => {
        await tx.paymentWebhookEvent.create({
          data: {
            organizationId: payment.organizationId,
            paymentId: payment.id,
            provider: payment.provider,
            providerEventId: payload.eventId,
            payloadHash: payloadHash(payload),
            signatureValid: true,
            processedAt: new Date()
          }
        });
        const result = await tx.payment.update({
          where: { id: payment.id },
          data: {
            status,
            paidAt: status === PaymentStatus.PAID ? new Date() : payment.paidAt,
            failedAt: status === PaymentStatus.FAILED ? new Date() : payment.failedAt,
            cancelledAt: status === PaymentStatus.CANCELLED ? new Date() : payment.cancelledAt
          }
        });
        await tx.paymentAttempt.create({ data: { paymentId: payment.id, status } });
        if (status === PaymentStatus.PAID) {
          await tx.quotation.update({ where: { id: payment.quotationId }, data: { paidAt: new Date() } });
          await tx.paymentReceipt.upsert({
            where: { paymentId: payment.id },
            create: {
              paymentId: payment.id,
              receiptNumber: `KAK-${payment.externalReference}`,
              metadata: { amount: serializeMoney(payment.amount.toString(), payment.currency), currency: payment.currency }
            },
            update: {}
          });
        }
        return result;
      });
    } catch (error) {
      if (!isUniqueConstraintError(error)) throw error;
      const current = await this.prisma.payment.findUnique({ where: { id: payment.id } });
      return { status: current?.status ?? payment.status, duplicate: true };
    }
    if (status === PaymentStatus.PAID) {
      await this.notify(updated, InAppNotificationType.PAYMENT_CONFIRMED);
    } else if (status === PaymentStatus.FAILED) {
      await this.notify(updated, InAppNotificationType.PAYMENT_FAILED);
    }
    return { status: updated.status, duplicate: false };
  }

  async get(organizationId: string, paymentId: string): Promise<Payment> {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, organizationId } });
    if (!payment) {
      throw new NotFoundException({ code: "PAYMENT_NOT_FOUND", message: "Payment not found" });
    }
    return payment;
  }

  async cancel(organizationId: string, paymentId: string): Promise<Payment> {
    const payment = await this.get(organizationId, paymentId);
    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.PROCESSING
    ) {
      throw new BadRequestException({ code: "PAYMENT_CANNOT_CANCEL", message: "Payment cannot be cancelled" });
    }
    await this.gateway.cancel(payment.externalReference);
    return this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CANCELLED, cancelledAt: new Date() }
    });
  }

  async refund(organizationId: string, paymentId: string, dto: RefundPaymentDto): Promise<Payment> {
    const payment = await this.get(organizationId, paymentId);
    const amount = new Prisma.Decimal(dto.amount);
    const serializedAmount = serializeMoney(amount.toString(), payment.currency);
    if (payment.status !== PaymentStatus.PAID || amount.greaterThan(payment.amount)) {
      throw new BadRequestException({ code: "PAYMENT_CANNOT_REFUND", message: "Refund is not valid" });
    }
    const fullRefund = amount.equals(payment.amount);
    await this.gateway.refund(payment.externalReference, serializedAmount, payment.currency);
    return this.prisma.$transaction(async (tx) => {
      await tx.paymentRefund.create({
        data: {
          paymentId: payment.id,
          amount,
          status: fullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
          reason: dto.reason?.trim() || null
        }
      });
      return tx.payment.update({
        where: { id: payment.id },
        data: { status: fullRefund ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED }
      });
    });
  }

  private async rotateCheckout(payment: Payment, locale: string): Promise<PublicPaymentIntent> {
    const checkoutToken = randomBytes(32).toString("base64url");
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { checkoutTokenHash: hashCheckoutToken(checkoutToken) }
    });
    return this.intentResponse(updated, checkoutToken, locale);
  }

  private intentResponse(payment: Payment, checkoutToken: string, locale: string): PublicPaymentIntent {
    return {
      paymentId: payment.id,
      status: payment.status,
      checkoutUrl: `${this.appPublicUrl}/${locale}/p/payments/${checkoutToken}`,
      amount: serializeMoney(payment.amount.toString(), payment.currency),
      currency: payment.currency
    };
  }

  private async findByCheckoutToken(checkoutToken: string) {
    if (!/^[A-Za-z0-9_-]{40,80}$/.test(checkoutToken)) {
      throw this.checkoutUnavailable();
    }
    const payment = await this.prisma.payment.findUnique({
      where: { checkoutTokenHash: hashCheckoutToken(checkoutToken) },
      include: {
        quotation: { include: { client: true } },
        organization: true
      }
    });
    if (!payment) {
      throw this.checkoutUnavailable();
    }
    return payment;
  }

  private checkoutUnavailable(): NotFoundException {
    return new NotFoundException({
      code: "PAYMENT_CHECKOUT_UNAVAILABLE",
      message: "Payment checkout is unavailable"
    });
  }

  private assertSandboxAvailable(): void {
    if (process.env.NODE_ENV === "production") {
      throw new ServiceUnavailableException({
        code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
        message: "A production payment provider is not configured"
      });
    }
  }

  private recordWebhook(
    payment: Payment,
    payload: PaymentWebhookPayload,
    signatureValid: boolean,
    processedAt: Date | null
  ) {
    return this.prisma.paymentWebhookEvent.upsert({
      where: { providerEventId: payload.eventId },
      create: {
        organizationId: payment.organizationId,
        paymentId: payment.id,
        provider: payment.provider,
        providerEventId: payload.eventId,
        payloadHash: payloadHash(payload),
        signatureValid,
        processedAt
      },
      update: {}
    });
  }

  private async notify(payment: Payment, type: InAppNotificationType): Promise<void> {
    const content = paymentNotificationContent(type);
    await this.notifications.notifyOrganization(payment.organizationId, {
      type,
      ...content,
      resourceType: "payment",
      resourceId: payment.id,
      route: `/organizations/${payment.organizationId}/quotations/${payment.quotationId}`
    });
  }
}

function hashCheckoutToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function payloadHash(payload: PaymentWebhookPayload): string {
  return createHash("sha256")
    .update(`${payload.eventId}\n${payload.externalReference}\n${payload.status}\n${payload.amount}\n${payload.currency}`, "utf8")
    .digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function paymentNotificationContent(type: InAppNotificationType): { title: string; body: string } {
  if (type === InAppNotificationType.PAYMENT_STARTED) {
    return { title: "Payment started", body: "A customer started a quotation payment." };
  }
  if (type === InAppNotificationType.PAYMENT_CONFIRMED) {
    return { title: "Payment confirmed", body: "A quotation payment was confirmed." };
  }
  if (type === InAppNotificationType.PAYMENT_FAILED) {
    return { title: "Payment failed", body: "A quotation payment failed." };
  }
  return { title: "Quotation approved", body: "A customer approved a quotation." };
}
