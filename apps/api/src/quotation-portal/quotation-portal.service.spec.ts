import { BadRequestException, GoneException, NotFoundException } from "@nestjs/common";
import { Prisma, QuotationStatus } from "@prisma/client";
import { QuotationPortalService } from "./quotation-portal.service";
import { createPublicToken, hashPublicToken } from "./public-token";

describe("QuotationPortalService", () => {
  beforeEach(() => {
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
  });

  it("issues a raw token once while persisting only its hash", async () => {
    const prisma = makePrisma();
    const service = new QuotationPortalService(prisma as never, notifications() as never);

    const result = await service.createLink("org-1", "quotation-1", "user-1", { locale: "es" });
    const createData = prisma.quotationPublicLink.create.mock.calls[0]?.[0].data as { tokenHash: string };

    expect(result.publicToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(result.url).toBe(`http://localhost:4200/es/p/quotations/${result.publicToken}`);
    expect(createData.tokenHash).toBe(hashPublicToken(result.publicToken));
    expect(JSON.stringify(createData)).not.toContain(result.publicToken);
  });

  it("turns a shared draft into sent and records an auditable transition", async () => {
    const prisma = makePrisma({ status: QuotationStatus.DRAFT });
    const service = new QuotationPortalService(prisma as never, notifications() as never);

    await service.createLink("org-1", "quotation-1", "user-1", {});

    expect(prisma.quotation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: QuotationStatus.SENT })
    }));
    expect(prisma.quotationStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ changedByUserId: "user-1", note: "quotation.portal.shared" })
    });
  });

  it("rejects link creation for a quotation outside the tenant", async () => {
    const prisma = makePrisma();
    prisma.quotation.findFirst.mockResolvedValueOnce(null as never);
    const service = new QuotationPortalService(prisma as never, notifications() as never);

    await expect(service.createLink("org-2", "quotation-1", "user-1", {}))
      .rejects.toBeInstanceOf(NotFoundException);
  });

  it("revokes every active link for the selected tenant quotation", async () => {
    const prisma = makePrisma();
    const service = new QuotationPortalService(prisma as never, notifications() as never);

    await expect(service.revokeLink("org-1", "quotation-1")).resolves.toEqual({ revoked: 1 });
    expect(prisma.quotationPublicLink.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", quotationId: "quotation-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) }
    });
  });

  it("returns the complete public view and records only the first view", async () => {
    const token = createPublicToken();
    const notify = notifications();
    const prisma = makePrisma();
    const service = new QuotationPortalService(prisma as never, notify as never);

    await expect(service.view(token)).resolves.toMatchObject({
      organization: { name: "Kaklen", country: "CL" },
      client: { displayName: "Cliente", whatsapp: "+56912345678" },
      quotation: {
        number: "QUO-000001",
        version: 1,
        latestVersion: 1,
        isLatestVersion: true,
        items: [{ index: 0 }, { index: 1 }]
      },
      actions: { canRequestChanges: true, canApproveAndPay: true, canOfferServices: false }
    });
    expect(notify.notifyOrganization).toHaveBeenCalledWith("org-1", expect.objectContaining({
      type: "QUOTATION_VIEWED"
    }));

    const alreadyViewed = makePrisma({ lastViewedAt: new Date() });
    const secondNotify = notifications();
    await new QuotationPortalService(alreadyViewed as never, secondNotify as never).view(token);
    expect(secondNotify.notifyOrganization).not.toHaveBeenCalled();
  });

  it("rejects expired and obsolete tokens without revealing which check failed", async () => {
    const token = createPublicToken();
    const expired = makePrisma();
    expired.quotationPublicLink.findUnique.mockResolvedValueOnce(null as never);
    const obsolete = makePrisma({ latestId: "quotation-2" });

    await expect(new QuotationPortalService(expired as never, notifications() as never).view(token))
      .rejects.toBeInstanceOf(NotFoundException);
    await expect(new QuotationPortalService(obsolete as never, notifications() as never).requestChanges(token, { comment: "Cambiar fecha" }))
      .rejects.toBeInstanceOf(GoneException);
  });

  it("uses the same unavailable response for revoked and expired links", async () => {
    const token = createPublicToken();
    const revoked = new QuotationPortalService(
      makePrisma({ revokedAt: new Date() }) as never,
      notifications() as never
    );
    const expired = new QuotationPortalService(
      makePrisma({ expiresAt: new Date("2020-01-01T00:00:00.000Z") }) as never,
      notifications() as never
    );

    await expect(revoked.view(token)).rejects.toBeInstanceOf(NotFoundException);
    await expect(expired.view(token)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("records public change requests with no fabricated internal actor", async () => {
    const prisma = makePrisma();
    const notify = notifications();
    const service = new QuotationPortalService(prisma as never, notify as never);
    const token = createPublicToken();

    await service.requestChanges(token, { comment: "Cambiar la segunda línea", itemIndexes: [1, 1] });

    expect(prisma.quotationChangeRequest.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ comment: "Cambiar la segunda línea", itemIndexes: [1] })
    });
    expect(prisma.quotationStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        newStatus: QuotationStatus.CHANGES_REQUESTED,
        changedByUserId: null
      })
    });
    expect(notify.notifyOrganization).toHaveBeenCalled();
  });

  it("rejects malformed tokens, invalid item references, and non-actionable states", async () => {
    await expect(new QuotationPortalService(makePrisma() as never, notifications() as never).view("short"))
      .rejects.toBeInstanceOf(NotFoundException);

    const token = createPublicToken();
    await expect(new QuotationPortalService(makePrisma() as never, notifications() as never)
      .requestChanges(token, { comment: "Cambiar línea", itemIndexes: [4] }))
      .rejects.toBeInstanceOf(BadRequestException);
    await expect(new QuotationPortalService(makePrisma({ status: QuotationStatus.APPROVED }) as never, notifications() as never)
      .requestChanges(token, { comment: "Cambiar línea" }))
      .rejects.toBeInstanceOf(BadRequestException);
  });

  it("approves the current sent quotation and exposes the provider invitation", async () => {
    const token = createPublicToken();
    const prisma = makePrisma();
    const notify = notifications();
    const service = new QuotationPortalService(prisma as never, notify as never);

    await expect(service.approve(token)).resolves.toEqual({ status: QuotationStatus.APPROVED });
    expect(prisma.quotation.update).toHaveBeenCalledWith({
      where: { id: "quotation-1" },
      data: { status: QuotationStatus.APPROVED, approvedAt: expect.any(Date) }
    });
    expect(notify.notifyOrganization).toHaveBeenCalledWith("org-1", expect.objectContaining({
      type: "QUOTATION_APPROVED"
    }));

    const approved = makePrisma({ status: QuotationStatus.APPROVED });
    await expect(new QuotationPortalService(approved as never, notifications() as never).view(token))
      .resolves.toMatchObject({ actions: { canOfferServices: true } });
  });

  it("rejects approval when the current quotation is not sent", async () => {
    const service = new QuotationPortalService(
      makePrisma({ status: QuotationStatus.CHANGES_REQUESTED }) as never,
      notifications() as never
    );

    await expect(service.approve(createPublicToken())).rejects.toBeInstanceOf(BadRequestException);
  });
});

function makePrisma(options: {
  status?: QuotationStatus;
  latestId?: string;
  lastViewedAt?: Date | null;
  revokedAt?: Date | null;
  expiresAt?: Date;
} = {}) {
  const quotation = quotationFixture(options.status ?? QuotationStatus.SENT);
  const link = {
    id: "link-1",
    organizationId: "org-1",
    quotationId: quotation.id,
    tokenHash: "hash",
    expiresAt: options.expiresAt ?? new Date("2099-01-01T00:00:00.000Z"),
    revokedAt: options.revokedAt ?? null,
    lastViewedAt: options.lastViewedAt ?? null,
    createdByUserId: "user-1",
    createdAt: new Date(),
    quotation
  };
  const tx = {
    quotationPublicLink: {
      updateMany: jest.fn(async () => ({ count: 1 })),
      create: jest.fn(async ({ data }: { data: { tokenHash: string; expiresAt: Date } }) => ({ ...link, ...data }))
    },
    quotation: { update: jest.fn(async () => quotation) },
    quotationStatusHistory: { create: jest.fn(async () => ({ id: "history-2" })) },
    quotationChangeRequest: { create: jest.fn(async () => ({ id: "change-1" })) },
    organizationAuditLog: { create: jest.fn(async () => ({ id: "audit-1" })) }
  };
  return {
    ...tx,
    quotation: {
      ...tx.quotation,
      findFirst: jest.fn(async (args: { orderBy?: unknown }) =>
        args.orderBy ? { id: options.latestId ?? quotation.id, version: options.latestId ? 2 : 1 } : quotation
      )
    },
    quotationPublicLink: {
      ...tx.quotationPublicLink,
      findUnique: jest.fn(async () => link)
    },
    $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx))
  };
}

function quotationFixture(status: QuotationStatus) {
  return {
    id: "quotation-1",
    organizationId: "org-1",
    clientId: "client-1",
    number: "QUO-000001",
    version: 1,
    status,
    issueDate: new Date("2026-07-01T00:00:00.000Z"),
    validUntil: new Date("2026-07-31T00:00:00.000Z"),
    currency: "CLP",
    subtotal: new Prisma.Decimal(1000),
    discountTotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(190),
    total: new Prisma.Decimal(1190),
    globalDiscountPercent: new Prisma.Decimal(0),
    notes: null,
    terms: null,
    createdByUserId: "user-1",
    approvedAt: null,
    rejectedAt: null,
    sentAt: new Date(),
    paidAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    archivedAt: null,
    organization: { name: "Kaklen", legalName: null, taxId: null, address: null, phone: null, whatsapp: null, country: "CL" },
    client: { displayName: "Cliente", legalName: null, taxId: "11111111-1", email: null, whatsapp: "+56912345678", address: null },
    items: [
      { code: "A", name: "Uno", description: null, quantity: new Prisma.Decimal(1), unit: "unidad", unitPrice: new Prisma.Decimal(500), discountType: "NONE", discountValue: new Prisma.Decimal(0), taxPercent: new Prisma.Decimal(19), total: new Prisma.Decimal(595), sortOrder: 1 },
      { code: "B", name: "Dos", description: null, quantity: new Prisma.Decimal(1), unit: "unidad", unitPrice: new Prisma.Decimal(500), discountType: "NONE", discountValue: new Prisma.Decimal(0), taxPercent: new Prisma.Decimal(19), total: new Prisma.Decimal(595), sortOrder: 2 }
    ],
    history: [{ newStatus: status, note: null, createdAt: new Date() }]
  };
}

function notifications() {
  return { notifyOrganization: jest.fn(async () => 1) };
}
