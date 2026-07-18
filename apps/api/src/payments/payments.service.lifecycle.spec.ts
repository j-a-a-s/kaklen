import { BadRequestException, NotFoundException } from "@nestjs/common";
import {
  InAppNotificationType,
  Payment,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  QuotationStatus
} from "@prisma/client";
import { PaymentGateway, PaymentIntentInput, PaymentWebhookPayload } from "./payment-gateway";
import { PaymentsService } from "./payments.service";

describe("PaymentsService lifecycle", () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
    process.env.NODE_ENV = "test";
  });

  it("creates one sandbox intent, approves a sent quotation, and notifies the organization", async () => {
    const prisma = makePrisma();
    const gateway = makeGateway();
    const notifications = makeNotifications();
    const service = makeService(prisma, gateway, notifications, QuotationStatus.SENT);

    await expect(service.createPublicIntent("public-token", {
      idempotencyKey: "11111111-1111-4111-8111-111111111111",
      locale: "es"
    })).resolves.toMatchObject({
      paymentId: "payment-1",
      status: PaymentStatus.PENDING,
      checkoutUrl: "http://localhost:4200/es/p/payments/checkout-token",
      amount: "1190",
      currency: "CLP"
    });

    expect(gateway.createPaymentIntent).toHaveBeenCalledWith({
      amount: "1190",
      currency: "CLP",
      reference: "QUO-000001-v1"
    });
    expect(prisma.quotation.update).toHaveBeenCalledWith({
      where: { id: "quotation-1" },
      data: { status: QuotationStatus.APPROVED, approvedAt: expect.any(Date) }
    });
    expect(prisma.quotationStatusHistory.create).toHaveBeenCalled();
    expect(notifications.notifyOrganization.mock.calls.map((call) => call[1].type)).toEqual([
      InAppNotificationType.QUOTATION_APPROVED,
      InAppNotificationType.PAYMENT_STARTED
    ]);
  });

  it("creates an intent for an already approved quotation without duplicating approval", async () => {
    const prisma = makePrisma();
    const notifications = makeNotifications();
    const service = makeService(prisma, makeGateway(), notifications, QuotationStatus.APPROVED);

    await service.createPublicIntent("public-token", {
      idempotencyKey: "22222222-2222-4222-8222-222222222222",
      locale: "en"
    });

    expect(prisma.quotation.update).not.toHaveBeenCalled();
    expect(notifications.notifyOrganization).toHaveBeenCalledTimes(1);
    expect(notifications.notifyOrganization).toHaveBeenCalledWith("org-1", expect.objectContaining({
      type: InAppNotificationType.PAYMENT_STARTED
    }));
  });

  it("recovers an idempotent payment created by a concurrent request", async () => {
    const prisma = makePrisma({ concurrentCreate: true });
    const service = makeService(prisma, makeGateway(), makeNotifications(), QuotationStatus.APPROVED);

    await expect(service.createPublicIntent("public-token", {
      idempotencyKey: "33333333-3333-4333-8333-333333333333",
      locale: "pt-BR"
    })).resolves.toMatchObject({ paymentId: "payment-1", status: PaymentStatus.PENDING });
    expect(prisma.payment.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "payment-1" }
    }));
  });

  it("loads checkout data, completes a pending sandbox payment, and preserves terminal state", async () => {
    const token = "a".repeat(43);
    const prisma = makePrisma();
    const gateway = makeGateway();
    const service = makeService(prisma, gateway, makeNotifications());

    await expect(service.checkout(token)).resolves.toMatchObject({
      payment: { status: PaymentStatus.PENDING, amount: "1190", currency: "CLP" },
      quotation: { number: "QUO-000001", version: 1, clientName: "Cliente" },
      organization: { name: "Kaklen" },
      sandbox: true
    });

    const processed = jest.spyOn(service, "processWebhook").mockResolvedValueOnce({
      status: PaymentStatus.PAID,
      duplicate: false
    });
    await expect(service.completeSandbox(token, { outcome: "PAID" }))
      .resolves.toEqual({ status: PaymentStatus.PAID, duplicate: false });
    expect(processed).toHaveBeenCalledWith(expect.objectContaining({ status: "PAID" }), "sandbox-signature");

    const paidService = makeService(makePrisma({ status: PaymentStatus.PAID }), makeGateway(), makeNotifications());
    await expect(paidService.completeSandbox(token, { outcome: "FAILED" }))
      .resolves.toEqual({ status: PaymentStatus.PAID });
  });

  it("hides malformed and unknown checkout tokens behind one error", async () => {
    const service = makeService(makePrisma(), makeGateway(), makeNotifications());
    await expect(service.checkout("short")).rejects.toBeInstanceOf(NotFoundException);

    const missing = makeService(makePrisma({ checkoutMissing: true }), makeGateway(), makeNotifications());
    await expect(missing.checkout("a".repeat(43))).rejects.toBeInstanceOf(NotFoundException);
  });

  it("gets and cancels only a pending organization payment", async () => {
    const prisma = makePrisma();
    const gateway = makeGateway();
    const service = makeService(prisma, gateway, makeNotifications());

    await expect(service.get("org-1", "payment-1")).resolves.toMatchObject({ id: "payment-1" });
    await expect(service.cancel("org-1", "payment-1"))
      .resolves.toMatchObject({ status: PaymentStatus.CANCELLED });
    expect(gateway.cancel).toHaveBeenCalledWith("sandbox-payment-1");

    await expect(makeService(makePrisma({ paymentMissing: true }), makeGateway(), makeNotifications())
      .get("org-2", "payment-1")).rejects.toBeInstanceOf(NotFoundException);
    await expect(makeService(makePrisma({ status: PaymentStatus.PAID }), makeGateway(), makeNotifications())
      .cancel("org-1", "payment-1")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("records partial and full refunds and rejects invalid refunds", async () => {
    const partialPrisma = makePrisma({ status: PaymentStatus.PAID });
    const partialGateway = makeGateway();
    const partial = makeService(partialPrisma, partialGateway, makeNotifications());
    await expect(partial.refund("org-1", "payment-1", { amount: 500, reason: " Ajuste " }))
      .resolves.toMatchObject({ status: PaymentStatus.PARTIALLY_REFUNDED });
    expect(partialPrisma.paymentRefund.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: PaymentStatus.PARTIALLY_REFUNDED,
        reason: "Ajuste"
      })
    });

    const full = makeService(makePrisma({ status: PaymentStatus.PAID }), makeGateway(), makeNotifications());
    await expect(full.refund("org-1", "payment-1", { amount: 1190 }))
      .resolves.toMatchObject({ status: PaymentStatus.REFUNDED });

    await expect(makeService(makePrisma(), makeGateway(), makeNotifications())
      .refund("org-1", "payment-1", { amount: 100 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(makeService(makePrisma({ status: PaymentStatus.PAID }), makeGateway(), makeNotifications())
      .refund("org-1", "payment-1", { amount: 2000 }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(makeService(makePrisma({ status: PaymentStatus.PAID }), makeGateway(), makeNotifications())
      .refund("org-1", "payment-1", { amount: 500.5 }))
      .rejects.toMatchObject({ response: { code: "CLP_FRACTION_NOT_ALLOWED" } });
  });

  it("records failed and processing webhooks without creating a receipt", async () => {
    const failedPrisma = makePrisma();
    const failedNotifications = makeNotifications();
    const failed = makeService(failedPrisma, makeGateway(), failedNotifications);
    await expect(failed.processWebhook(webhook("FAILED"), "sandbox-signature"))
      .resolves.toEqual({ status: PaymentStatus.FAILED, duplicate: false });
    expect(failedNotifications.notifyOrganization).toHaveBeenCalledWith("org-1", expect.objectContaining({
      type: InAppNotificationType.PAYMENT_FAILED
    }));
    expect(failedPrisma.paymentReceipt.upsert).not.toHaveBeenCalled();

    const processingPrisma = makePrisma();
    const processingNotifications = makeNotifications();
    const processing = makeService(processingPrisma, makeGateway(), processingNotifications);
    await expect(processing.processWebhook(webhook("PROCESSING"), "sandbox-signature"))
      .resolves.toEqual({ status: PaymentStatus.PROCESSING, duplicate: false });
    expect(processingNotifications.notifyOrganization).not.toHaveBeenCalled();
  });
});

function makeService(
  prisma: ReturnType<typeof makePrisma>,
  gateway: jest.Mocked<PaymentGateway>,
  notifications: ReturnType<typeof makeNotifications>,
  quotationStatus: QuotationStatus = QuotationStatus.APPROVED
): PaymentsService {
  return new PaymentsService(
    prisma as never,
    {
      resolve: jest.fn(async () => ({
        link: { id: "link-1" },
        quotation: {
          id: "quotation-1",
          organizationId: "org-1",
          number: "QUO-000001",
          version: 1,
          status: quotationStatus,
          globalDiscountPercent: new Prisma.Decimal(0),
          subtotal: new Prisma.Decimal(1000),
          discountTotal: new Prisma.Decimal(0),
          taxTotal: new Prisma.Decimal(190),
          total: new Prisma.Decimal(1190),
          currency: "CLP",
          items: [{
            quantity: new Prisma.Decimal(1),
            unitPrice: new Prisma.Decimal(1000),
            discountType: "NONE",
            discountValue: new Prisma.Decimal(0),
            taxPercent: new Prisma.Decimal(19),
            subtotal: new Prisma.Decimal(1000),
            discountTotal: new Prisma.Decimal(0),
            taxTotal: new Prisma.Decimal(190),
            total: new Prisma.Decimal(1190)
          }]
        }
      }))
    } as never,
    notifications as never,
    gateway
  );
}

function makePrisma(options: {
  status?: PaymentStatus;
  checkoutMissing?: boolean;
  paymentMissing?: boolean;
  concurrentCreate?: boolean;
} = {}) {
  const payment = paymentFixture(options.status ?? PaymentStatus.PENDING);
  let idempotencyLookups = 0;
  const tx = {
    quotation: { update: jest.fn(async () => ({ id: "quotation-1" })) },
    quotationStatusHistory: { create: jest.fn(async () => ({ id: "history-1" })) },
    payment: {
      create: jest.fn(async () => payment),
      update: jest.fn(async ({ data }: { data: Partial<Payment> }) => ({ ...payment, ...data }))
    },
    paymentWebhookEvent: { create: jest.fn(async () => ({ id: "webhook-1" })) },
    paymentAttempt: { create: jest.fn(async () => ({ id: "attempt-1" })) },
    paymentReceipt: { upsert: jest.fn(async () => ({ id: "receipt-1" })) },
    paymentRefund: { create: jest.fn(async () => ({ id: "refund-1" })) }
  };
  return {
    ...tx,
    payment: {
      ...tx.payment,
      findUnique: jest.fn(async ({ where }: { where: Record<string, unknown> }) => {
        if (where["organizationId_idempotencyKey"]) {
          idempotencyLookups += 1;
          return options.concurrentCreate && idempotencyLookups > 1 ? payment : null;
        }
        if (where["checkoutTokenHash"]) {
          return options.checkoutMissing ? null : enrichedPayment(payment);
        }
        return payment;
      }),
      findFirst: jest.fn(async () => options.paymentMissing ? null : payment)
    },
    paymentWebhookEvent: {
      ...tx.paymentWebhookEvent,
      findUnique: jest.fn(async () => null),
      upsert: jest.fn(async () => ({ id: "webhook-record" }))
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      if (options.concurrentCreate && idempotencyLookups === 1) {
        throw new Prisma.PrismaClientKnownRequestError("Concurrent payment", {
          code: "P2002",
          clientVersion: "6.11.1"
        });
      }
      return callback(tx);
    })
  };
}

function makeGateway(): jest.Mocked<PaymentGateway> {
  return {
    createPaymentIntent: jest.fn(async (_input: PaymentIntentInput) => ({
      externalReference: "sandbox-payment-1",
      checkoutToken: "checkout-token",
      providerReference: "provider-1"
    })),
    getPaymentStatus: jest.fn(async (_externalReference: string): Promise<PaymentStatus> => PaymentStatus.PENDING),
    processWebhook: jest.fn((payload: PaymentWebhookPayload) => payload),
    verifyWebhookSignature: jest.fn((_payload: PaymentWebhookPayload, _signature: string) => true),
    cancel: jest.fn(async (_externalReference: string): Promise<PaymentStatus> => PaymentStatus.CANCELLED),
    refund: jest.fn(async (_externalReference: string, _amount: string, _currency: string): Promise<PaymentStatus> => PaymentStatus.REFUNDED),
    createSignedWebhook: jest.fn((_reference, status, amount, currency) => ({
      payload: webhook(status, amount, currency),
      signature: "sandbox-signature"
    }))
  };
}

function makeNotifications() {
  return {
    notifyOrganization: jest.fn(async (
      _organizationId: string,
      _input: { type: InAppNotificationType }
    ) => 1)
  };
}

function paymentFixture(status: PaymentStatus): Payment {
  const now = new Date("2026-07-17T00:00:00.000Z");
  return {
    id: "payment-1",
    organizationId: "org-1",
    quotationId: "quotation-1",
    publicLinkId: "link-1",
    provider: PaymentProvider.SANDBOX,
    status,
    amount: new Prisma.Decimal(1190),
    currency: "CLP",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    externalReference: "sandbox-payment-1",
    checkoutTokenHash: "hash",
    paidAt: null,
    cancelledAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function enrichedPayment(payment: Payment) {
  return {
    ...payment,
    quotation: {
      number: "QUO-000001",
      version: 1,
      client: { displayName: "Cliente" }
    },
    organization: { name: "Kaklen" }
  };
}

function webhook(
  status: PaymentWebhookPayload["status"],
  amount = "1190.00",
  currency = "CLP"
): PaymentWebhookPayload {
  return {
    eventId: `event-${status.toLowerCase()}`,
    externalReference: "sandbox-payment-1",
    status,
    amount,
    currency
  };
}
