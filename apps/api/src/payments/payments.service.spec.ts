import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { PaymentProvider, PaymentStatus, Prisma, QuotationStatus } from "@prisma/client";
import { PaymentsService } from "./payments.service";
import { PaymentGateway, PaymentIntentInput, PaymentWebhookPayload } from "./payment-gateway";

describe("PaymentsService", () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
  });

  it("reuses an idempotent payment and rotates only its checkout token", async () => {
    const payment = paymentFixture();
    const prisma = makePrisma({ existingPayment: payment });
    const gateway = makeGateway();
    const service = makeService(prisma, gateway);

    const result = await service.createPublicIntent("public-token", {
      idempotencyKey: payment.idempotencyKey,
      locale: "es"
    });

    expect(result.paymentId).toBe(payment.id);
    expect(result.checkoutUrl).toMatch(/^http:\/\/localhost:4200\/es\/p\/payments\/[A-Za-z0-9_-]{43}$/);
    expect(gateway.createPaymentIntent).not.toHaveBeenCalled();
    expect(prisma.payment.update).toHaveBeenCalledWith({
      where: { id: payment.id },
      data: { checkoutTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/) }
    });
  });

  it("rejects invalid webhook signatures and records no processed success", async () => {
    const prisma = makePrisma();
    const gateway = makeGateway(false);
    const service = makeService(prisma, gateway);

    await expect(service.processWebhook(webhook(), "bad-signature"))
      .rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ signatureValid: false, processedAt: null })
    }));
    expect(prisma.payment.update).not.toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: PaymentStatus.PAID })
    }));
  });

  it("uses a verified webhook as the source of truth and creates one receipt", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeGateway(true));

    await expect(service.processWebhook(webhook(), "valid-signature"))
      .resolves.toEqual({ status: PaymentStatus.PAID, duplicate: false });

    expect(prisma.quotation.update).toHaveBeenCalledWith({
      where: { id: "quotation-1" }, data: { paidAt: expect.any(Date) }
    });
    expect(prisma.paymentReceipt.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.paymentWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ providerEventId: "event-1", signatureValid: true, processedAt: expect.any(Date) })
    });
  });

  it("returns the current state for duplicate provider events without applying payment twice", async () => {
    const prisma = makePrisma({ duplicate: true });
    const service = makeService(prisma, makeGateway(true));

    await expect(service.processWebhook(webhook(), "valid-signature"))
      .resolves.toEqual({ status: PaymentStatus.PENDING, duplicate: true });
    expect(prisma.paymentWebhookEvent.create).not.toHaveBeenCalled();
    expect(prisma.paymentReceipt.upsert).not.toHaveBeenCalled();
  });

  it("treats a concurrent unique webhook collision as an idempotent duplicate", async () => {
    const prisma = makePrisma({ concurrentWebhook: true });
    const service = makeService(prisma, makeGateway(true));

    await expect(service.processWebhook(webhook(), "valid-signature"))
      .resolves.toEqual({ status: PaymentStatus.PENDING, duplicate: true });
    expect(prisma.paymentReceipt.upsert).not.toHaveBeenCalled();
  });

  it("rejects a signed webhook whose amount does not match", async () => {
    const prisma = makePrisma();
    const service = makeService(prisma, makeGateway(true));

    await expect(service.processWebhook({ ...webhook(), amount: "100.00" }, "valid-signature"))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.paymentWebhookEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ signatureValid: true, processedAt: null })
    }));
  });

  it("refuses to expose the sandbox payment lifecycle in production", async () => {
    const previousNodeEnv = process.env.NODE_ENV;
    try {
      const prisma = makePrisma();
      const service = makeService(prisma, makeGateway());
      process.env.NODE_ENV = "production";

      await expect(service.createPublicIntent("public-token", {
        idempotencyKey: "11111111-1111-4111-8111-111111111111",
        locale: "es"
      })).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(prisma.payment.findUnique).not.toHaveBeenCalled();
    } finally {
      if (previousNodeEnv === undefined) {
        delete process.env.NODE_ENV;
      } else {
        process.env.NODE_ENV = previousNodeEnv;
      }
    }
  });
});

function makeService(prisma: ReturnType<typeof makePrisma>, gateway: jest.Mocked<PaymentGateway>): PaymentsService {
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
          status: QuotationStatus.APPROVED,
          total: new Prisma.Decimal(1190),
          currency: "CLP"
        }
      }))
    } as never,
    { notifyOrganization: jest.fn(async () => 1) } as never,
    gateway
  );
}

function makeGateway(signatureValid = true): jest.Mocked<PaymentGateway> {
  return {
    createPaymentIntent: jest.fn(async (_input: PaymentIntentInput) => ({ externalReference: "sandbox_1", checkoutToken: "token", providerReference: "provider" })),
    getPaymentStatus: jest.fn(async (_externalReference: string): Promise<PaymentStatus> => PaymentStatus.PENDING),
    processWebhook: jest.fn((payload: PaymentWebhookPayload) => payload),
    verifyWebhookSignature: jest.fn((_payload: PaymentWebhookPayload, _signature: string) => signatureValid),
    cancel: jest.fn(async (_externalReference: string): Promise<PaymentStatus> => PaymentStatus.CANCELLED),
    refund: jest.fn(async (_externalReference: string, _amount: string): Promise<PaymentStatus> => PaymentStatus.REFUNDED),
    createSignedWebhook: jest.fn((_externalReference: string, _status: PaymentWebhookPayload["status"], _amount: string, _currency: string) => ({ payload: webhook(), signature: "signature" }))
  };
}

function makePrisma(options: {
  existingPayment?: ReturnType<typeof paymentFixture>;
  duplicate?: boolean;
  concurrentWebhook?: boolean;
} = {}) {
  const payment = options.existingPayment ?? paymentFixture();
  const tx = {
    paymentWebhookEvent: {
      create: jest.fn(async () => ({ id: "webhook-1" }))
    },
    payment: {
      update: jest.fn(async ({ data }: { data: Partial<typeof payment> }) => ({ ...payment, ...data, status: data.status ?? payment.status }))
    },
    paymentAttempt: { create: jest.fn(async () => ({ id: "attempt-1" })) },
    quotation: { update: jest.fn(async () => ({ id: "quotation-1" })) },
    paymentReceipt: { upsert: jest.fn(async () => ({ id: "receipt-1" })) }
  };
  return {
    ...tx,
    payment: {
      ...tx.payment,
      findUnique: jest.fn(async (args: { where: { organizationId_idempotencyKey?: unknown; externalReference?: string; id?: string } }) => {
        if (args.where.organizationId_idempotencyKey) return options.existingPayment ?? null;
        return payment;
      })
    },
    paymentWebhookEvent: {
      ...tx.paymentWebhookEvent,
      findUnique: jest.fn(async () => options.duplicate ? { id: "webhook-existing" } : null),
      upsert: jest.fn(async () => ({ id: "webhook-recorded" }))
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
      if (options.concurrentWebhook) {
        throw new Prisma.PrismaClientKnownRequestError("Concurrent provider event", {
          code: "P2002",
          clientVersion: "6.11.1"
        });
      }
      return callback(tx);
    })
  };
}

function paymentFixture() {
  const now = new Date();
  return {
    id: "payment-1",
    organizationId: "org-1",
    quotationId: "quotation-1",
    publicLinkId: "link-1",
    provider: PaymentProvider.SANDBOX,
    status: PaymentStatus.PENDING,
    amount: new Prisma.Decimal(1190),
    currency: "CLP",
    idempotencyKey: "11111111-1111-4111-8111-111111111111",
    externalReference: "sandbox_1",
    checkoutTokenHash: "hash",
    paidAt: null,
    cancelledAt: null,
    failedAt: null,
    createdAt: now,
    updatedAt: now
  };
}

function webhook(): PaymentWebhookPayload {
  return {
    eventId: "event-1",
    externalReference: "sandbox_1",
    status: "PAID",
    amount: "1190.00",
    currency: "CLP"
  };
}
