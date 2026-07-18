import { BadRequestException, ForbiddenException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { CatalogItemStatus, CatalogItemType, Prisma, QuotationDiscountType, QuotationItemType, QuotationStatus } from "@prisma/client";
import { QuotationsService } from "./quotations.service";

type TransitionProbe = {
  assertTransition(previous: QuotationStatus, next: QuotationStatus): void;
};

type DatesProbe = {
  assertDates(issueDate: string, validUntil: string): void;
};

type NumberProbe = {
  nextNumber(
    organizationId: string,
    tx: { quotation: { findFirst(args: unknown): Promise<{ number: string } | null> } }
  ): Promise<string>;
};

describe("QuotationsService", () => {
  const service = new QuotationsService({} as ConstructorParameters<typeof QuotationsService>[0]);

  it("calculates totals without discount", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 2, unitPrice: 100, taxPercent: 19 })
    ]);

    expect(result.subtotal.equals("200")).toBe(true);
    expect(result.discountTotal.equals("0")).toBe(true);
    expect(result.taxTotal.equals("38")).toBe(true);
    expect(result.total.equals("238")).toBe(true);
  });

  it("calculates percentage discounts", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 1, unitPrice: 1000, discountType: QuotationDiscountType.PERCENTAGE, discountValue: 10, taxPercent: 0 })
    ]);

    expect(result.discountTotal.equals("100")).toBe(true);
    expect(result.total.equals("900")).toBe(true);
  });

  it("rejects fixed discounts above the line subtotal", () => {
    expect(() => service.calculateQuotationItems([
      item({ quantity: 1, unitPrice: 50, discountType: QuotationDiscountType.FIXED, discountValue: 80, taxPercent: 19 })
    ])).toThrow(BadRequestException);
  });

  it("rejects NONE with a non-zero discount", () => {
    expect(() => service.calculateQuotationItems([
      item({ discountType: QuotationDiscountType.NONE, discountValue: 1 })
    ])).toThrow(BadRequestException);
  });

  it("calculates valid two-decimal monetary values without drift", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 3, unitPrice: 33.33, taxPercent: 19 })
    ]);

    expect(result.subtotal.equals("99.99")).toBe(true);
    expect(result.taxTotal.equals("19")).toBe(true);
  });

  it("rejects fractional CLP unit prices with a stable code", () => {
    try {
      service.calculateQuotationItems([item({ unitPrice: 1000.5 })], new Map(), 0, "CLP");
      fail("Expected CLP precision validation to fail");
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: "CLP_FRACTION_NOT_ALLOWED" });
    }
  });

  it("rejects over-precision amounts in fractional currencies with a stable code", () => {
    try {
      service.calculateQuotationItems([item({ unitPrice: 1000.555 })], new Map(), 0, "USD");
      fail("Expected money precision validation to fail");
    } catch (error) {
      expect((error as BadRequestException).getResponse()).toMatchObject({ code: "MONEY_PRECISION_NOT_ALLOWED" });
    }
  });

  it("applies a global discount to every line net after its line discount", () => {
    const result = service.calculateQuotationItems([
      item({ unitPrice: 1000, taxPercent: 19 }),
      item({ unitPrice: 1000, discountType: QuotationDiscountType.PERCENTAGE, discountValue: 10, taxPercent: 19 }),
      item({ unitPrice: 1000, discountType: QuotationDiscountType.FIXED, discountValue: 50, taxPercent: 0 })
    ], new Map(), 5);

    expect(result.subtotal.equals("3000")).toBe(true);
    expect(result.discountTotal.equals("292.50")).toBe(true);
    expect(result.taxTotal.equals("342.95")).toBe(true);
    expect(result.total.equals("3050.45")).toBe(true);
  });

  it("rejects invalid global discounts", () => {
    expect(() => service.calculateQuotationItems([item()], new Map(), -0.01)).toThrow(BadRequestException);
    expect(() => service.calculateQuotationItems([item()], new Map(), 100.01)).toThrow(BadRequestException);
  });

  it("rejects invalid date ranges", () => {
    const probe = service as unknown as DatesProbe;

    expect(() => probe.assertDates("2026-08-10", "2026-08-09")).toThrow(BadRequestException);
  });

  it("allows valid status transitions and rejects invalid ones", () => {
    const probe = service as unknown as TransitionProbe;

    expect(() => probe.assertTransition(QuotationStatus.DRAFT, QuotationStatus.SENT)).not.toThrow();
    expect(() => probe.assertTransition(QuotationStatus.APPROVED, QuotationStatus.SENT)).toThrow(BadRequestException);
  });

  it("generates sequential quotation numbers", async () => {
    const probe = service as unknown as NumberProbe;
    const number = await probe.nextNumber("org-1", {
      quotation: {
        findFirst: async () => ({ number: "QUO-000009" })
      }
    });

    expect(number).toBe("QUO-000010");
  });

  it("uses catalog snapshots for catalog-backed items", () => {
    const catalogItem = {
      id: "catalog-1",
      organizationId: "org-1",
      type: CatalogItemType.SERVICE,
      status: CatalogItemStatus.ACTIVE,
      sku: null,
      code: "CONSULTING",
      name: "Consulting",
      description: "Snapshot",
      unit: "hour",
      cost: new Prisma.Decimal(10),
      price: new Prisma.Decimal(120),
      taxPercent: new Prisma.Decimal(19),
      currency: "CLP",
      trackInventory: false,
      createdByUserId: "user-1",
      createdAt: new Date(),
      updatedAt: new Date(),
      archivedAt: null
    };
    const result = service.calculateQuotationItems(
      [item({ catalogItemId: "catalog-1", type: QuotationItemType.CUSTOM, name: "Ignored", unitPrice: 1, taxPercent: 0 })],
      new Map([["catalog-1", catalogItem]])
    );

    expect(result.items[0]?.name).toBe("Consulting");
    expect(result.items[0]?.unitPrice.equals("120")).toBe(true);
  });

  it("creates a quotation with catalog-backed totals and audit history", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    const created = await realService.create("org-1", "user-1", {
      clientId: "client-1",
      issueDate: "2026-08-01",
      validUntil: "2026-08-31",
      currency: "clp",
      notes: "  Nota ",
      terms: " Pago contado ",
      items: [item({ catalogItemId: "catalog-1", quantity: 2, unitPrice: 1, taxPercent: 0 })]
    });

    expect(created.id).toBe("quotation-1");
    expect(prisma.client.findFirst).toHaveBeenCalledWith({ where: { id: "client-1", organizationId: "org-1", archivedAt: null } });
    expect(callData(prisma.quotation.create)).toMatchObject({
      organizationId: "org-1",
      clientId: "client-1",
      number: "QUO-000002",
      currency: "CLP",
      notes: "Nota",
      terms: "Pago contado",
      createdByUserId: "user-1",
      items: {
        create: [
          expect.objectContaining({
            catalogItemId: "catalog-1",
            name: "Consulting",
            quantity: new Prisma.Decimal(2),
            unitPrice: new Prisma.Decimal(120),
            taxPercent: new Prisma.Decimal(19)
          })
        ]
      }
    });
    expect(prisma.quotationStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ previousStatus: null, newStatus: QuotationStatus.DRAFT, note: "quotation.created" })
    });
  });

  it("creates quotations with organization defaults when optional values are omitted", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await realService.create("org-1", "user-1", {
      clientId: "client-1",
      issueDate: "2026-08-01",
      validUntil: "2026-08-31",
      items: [item({ discountType: undefined, discountValue: undefined, taxPercent: 19 })]
    });

    expect(prisma.catalogItem.findMany).not.toHaveBeenCalled();
    expect(callData(prisma.quotation.create)).toMatchObject({
      currency: "CLP",
      notes: null,
      terms: null,
      items: {
        create: [
          expect.objectContaining({
            catalogItemId: null,
            discountType: QuotationDiscountType.NONE,
            discountValue: new Prisma.Decimal(0),
            taxPercent: new Prisma.Decimal(19)
          })
        ]
      }
    });
  });

  it("rejects quotations for clients or catalog items outside the organization", async () => {
    const foreignClient = makeQuotationsPrisma({ client: null });
    const foreignCatalog = makeQuotationsPrisma({ catalogItems: [] });

    await expect(
      new QuotationsService(foreignClient as unknown as ConstructorParameters<typeof QuotationsService>[0]).create("org-1", "user-1", {
        clientId: "client-b",
        issueDate: "2026-08-01",
        validUntil: "2026-08-31",
        items: [item()]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      new QuotationsService(foreignCatalog as unknown as ConstructorParameters<typeof QuotationsService>[0]).create("org-1", "user-1", {
        clientId: "client-1",
        issueDate: "2026-08-01",
        validUntil: "2026-08-31",
        items: [item({ catalogItemId: "catalog-b" })]
      })
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("lists and summarizes organization-scoped quotations", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.list("org-1", { page: 2, pageSize: 5, status: QuotationStatus.SENT, search: "QUO" })).resolves.toMatchObject({
      page: 2,
      pageSize: 5,
      total: 1,
      totalPages: 1
    });
    await expect(realService.summary("org-1")).resolves.toMatchObject({
      total: 6,
      draft: 1,
      approved: 5,
      baseCurrency: "CLP",
      baseCurrencyApprovedAmount: "150000",
      approvedAmounts: [
        { currency: "CLP", amount: "150000", quotationCount: 2 },
        { currency: "BRL", amount: "800.00", quotationCount: 1 },
        { currency: "EUR", amount: "100.50", quotationCount: 1 },
        { currency: "USD", amount: "500.25", quotationCount: 1 }
      ]
    });
    expect(prisma.quotation.groupBy).toHaveBeenNthCalledWith(2, {
      by: ["currency"],
      where: { organizationId: "org-1", archivedAt: null, status: QuotationStatus.APPROVED },
      _sum: { total: true },
      _count: { _all: true },
      orderBy: { currency: "asc" }
    });
  });

  it("keeps single-currency and empty approved summaries exact", async () => {
    const singleCurrency = makeQuotationsPrisma({
      approvedByCurrency: [{ currency: "USD", amount: "20.5", count: 1 }],
      organizationCurrency: "USD"
    });
    const empty = makeQuotationsPrisma({ approvedByCurrency: [] });

    await expect(new QuotationsService(singleCurrency as unknown as ConstructorParameters<typeof QuotationsService>[0])
      .summary("org-1")).resolves.toMatchObject({
        baseCurrency: "USD",
        baseCurrencyApprovedAmount: "20.50",
        approvedAmounts: [{ currency: "USD", amount: "20.50", quotationCount: 1 }]
      });
    await expect(new QuotationsService(empty as unknown as ConstructorParameters<typeof QuotationsService>[0])
      .summary("org-1")).resolves.toMatchObject({
        baseCurrency: "CLP",
        baseCurrencyApprovedAmount: "0",
        approvedAmounts: []
      });
  });

  it("returns newest tenant change requests with version item snapshots", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.changeRequests("org-1", "quotation-1")).resolves.toEqual([
      {
        id: "change-1",
        quotationId: "quotation-1",
        quotationVersion: 2,
        comment: "Cambiar el alcance",
        itemIndexes: [0],
        items: [{ index: 0, name: "Historical consulting", code: "HISTORICAL" }],
        createdAt: "2026-07-16T00:00:00.000Z"
      }
    ]);
    expect(prisma.quotationChangeRequest.findMany).toHaveBeenCalledWith({
      where: {
        organizationId: "org-1",
        quotation: { number: "QUO-000001" }
      },
      orderBy: { createdAt: "desc" },
      include: {
        quotation: {
          select: {
            version: true,
            items: {
              orderBy: { sortOrder: "asc" },
              select: { name: true, code: true }
            }
          }
        }
      }
    });
    expect(JSON.stringify(await realService.changeRequests("org-1", "quotation-1")))
      .not.toMatch(/publicToken|tokenHash|publicLinkId/);
  });

  it("rejects change requests outside the quotation organization", async () => {
    const prisma = makeQuotationsPrisma({ quotation: null });
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.changeRequests("org-2", "quotation-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.quotationChangeRequest.findMany).not.toHaveBeenCalled();
  });

  it("uses default list pagination and date filter permutations", async () => {
    const defaults = makeQuotationsPrisma();
    const filtered = makeQuotationsPrisma();

    await new QuotationsService(defaults as unknown as ConstructorParameters<typeof QuotationsService>[0]).list("org-1", {});
    await new QuotationsService(filtered as unknown as ConstructorParameters<typeof QuotationsService>[0]).list("org-1", {
      issueDateFrom: "2026-08-01",
      validUntilTo: "2026-09-01"
    });

    expect(defaults.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: "desc" },
        skip: 0,
        take: 20,
        where: { organizationId: "org-1", archivedAt: null }
      })
    );
    expect(filtered.quotation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          issueDate: { gte: new Date("2026-08-01") },
          validUntil: { lte: new Date("2026-09-01") }
        })
      })
    );
  });

  it("updates only draft quotations and replaces items transactionally", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await realService.update("org-1", "quotation-1", "user-1", {
      clientId: "client-1",
      issueDate: "2026-08-02",
      validUntil: "2026-09-01",
      currency: "usd",
      notes: "",
      terms: " Nuevos terminos ",
      items: [item({ quantity: 1, unitPrice: 500, taxPercent: 0 })]
    });

    expect(prisma.quotationItem.deleteMany).toHaveBeenCalledWith({ where: { quotationId: "quotation-1" } });
    expect(callData(prisma.quotation.update)).toMatchObject({
      clientId: "client-1",
      currency: "USD",
      notes: null,
      terms: "Nuevos terminos",
      subtotal: new Prisma.Decimal(500)
    });

    const sent = makeQuotationsPrisma({ quotationStatus: QuotationStatus.SENT });
    await expect(
      new QuotationsService(sent as unknown as ConstructorParameters<typeof QuotationsService>[0]).update("org-1", "quotation-1", "user-1", {
        notes: "No permitido"
      })
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("updates draft metadata without replacing items when no item list is provided", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await realService.update("org-1", "quotation-1", "user-1", {});

    expect(prisma.client.findFirst).not.toHaveBeenCalled();
    expect(prisma.quotationItem.deleteMany).not.toHaveBeenCalled();
    expect(callData(prisma.quotation.update)).toMatchObject({
      clientId: undefined,
      issueDate: undefined,
      validUntil: undefined,
      notes: undefined,
      terms: undefined
    });
  });

  it("archives and changes status with timestamped transitions", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await realService.archive("org-1", "quotation-1", "user-1");
    await realService.send("org-1", "quotation-1", "user-1", { note: " Enviada " });

    expect(callData(prisma.quotation.update)).toMatchObject({ archivedAt: expect.any(Date) });
    expect(callData(prisma.quotation.update, 1)).toMatchObject({
      status: QuotationStatus.SENT,
      sentAt: expect.any(Date)
    });
    expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "quotation.sent", targetId: "quotation-1" })
    });
  });

  it("timestamps approval, rejection, and cancellation transitions independently", async () => {
    const approved = makeQuotationsPrisma({ quotationStatus: QuotationStatus.SENT });
    const rejected = makeQuotationsPrisma({ quotationStatus: QuotationStatus.SENT });
    const cancelled = makeQuotationsPrisma();

    await new QuotationsService(approved as unknown as ConstructorParameters<typeof QuotationsService>[0]).approve("org-1", "quotation-1", "user-1", {});
    await new QuotationsService(rejected as unknown as ConstructorParameters<typeof QuotationsService>[0]).reject("org-1", "quotation-1", "user-1", {});
    await new QuotationsService(cancelled as unknown as ConstructorParameters<typeof QuotationsService>[0]).cancel("org-1", "quotation-1", "user-1", {});

    expect(callData(approved.quotation.update)).toMatchObject({
      status: QuotationStatus.APPROVED,
      sentAt: null,
      approvedAt: expect.any(Date),
      rejectedAt: null
    });
    expect(callData(rejected.quotation.update)).toMatchObject({
      status: QuotationStatus.REJECTED,
      sentAt: null,
      approvedAt: null,
      rejectedAt: expect.any(Date)
    });
    expect(callData(cancelled.quotation.update)).toMatchObject({
      status: QuotationStatus.CANCELLED,
      sentAt: null,
      approvedAt: null,
      rejectedAt: null
    });
  });

  it("rejects missing quotations and invalid status transitions", async () => {
    const missing = makeQuotationsPrisma({ quotation: null });
    const approved = makeQuotationsPrisma({ quotationStatus: QuotationStatus.APPROVED });

    await expect(
      new QuotationsService(missing as unknown as ConstructorParameters<typeof QuotationsService>[0]).get("org-1", "missing")
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      new QuotationsService(approved as unknown as ConstructorParameters<typeof QuotationsService>[0]).send("org-1", "quotation-1", "user-1", {})
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("generates a localized real PDF for an organization-scoped quotation", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    const document = await realService.pdfDocument("org-1", "quotation-1", "pt-BR");

    expect(document.buffer.subarray(0, 4).toString()).toBe("%PDF");
    expect(document.filename).toBe("cotacao-quo-000001-v1.pdf");
    expect(prisma.quotation.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "quotation-1", organizationId: "org-1", archivedAt: null }
    }));
  });

  it("sends quotation email with a PDF before marking the quotation as sent", async () => {
    const prisma = makeQuotationsPrisma();
    const mailService = {
      isCommercialEmailEnabled: () => true,
      send: jest.fn(async (_message: unknown) => undefined)
    };
    const realService = new QuotationsService(
      prisma as unknown as ConstructorParameters<typeof QuotationsService>[0],
      mailService as unknown as ConstructorParameters<typeof QuotationsService>[1]
    );

    await realService.sendEmail("org-1", "quotation-1", "user-1", {
      to: " CLIENTE@EXAMPLE.COM ",
      subject: " Cotización de servicios ",
      message: " Revisa nuestra propuesta. ",
      locale: "es"
    });

    expect(mailService.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "cliente@example.com",
      subject: "Cotización de servicios",
      attachments: [expect.objectContaining({
        filename: "cotizacion-quo-000001-v1.pdf",
        contentType: "application/pdf",
        content: expect.any(Buffer)
      })]
    }));
    const sentMessage = mailService.send.mock.calls[0]?.[0] as { attachments?: Array<{ content: Buffer }> } | undefined;
    const attachment = sentMessage?.attachments?.[0]?.content;
    expect(attachment?.subarray(0, 4).toString()).toBe("%PDF");
    expect(callData(prisma.quotation.update)).toMatchObject({ status: QuotationStatus.SENT, sentAt: expect.any(Date) });
    expect(prisma.quotationStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ note: "quotation.email.sent|cliente@example.com" })
    });
    expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ action: "quotation.email.sent", metadata: { recipientDomain: "example.com" } })
    });
  });

  it("does not change state or write audit history when SMTP fails", async () => {
    const prisma = makeQuotationsPrisma();
    const mailService = {
      isCommercialEmailEnabled: () => true,
      send: jest.fn(async (_message: unknown) => { throw new Error("SMTP unavailable"); })
    };
    const realService = new QuotationsService(
      prisma as unknown as ConstructorParameters<typeof QuotationsService>[0],
      mailService as unknown as ConstructorParameters<typeof QuotationsService>[1]
    );

    await expect(realService.sendEmail("org-1", "quotation-1", "user-1", {
      to: "cliente@example.com",
      subject: "Cotización",
      message: "Revisa nuestra propuesta.",
      locale: "es"
    })).rejects.toThrow("SMTP unavailable");

    expect(prisma.quotation.update).not.toHaveBeenCalled();
    expect(prisma.quotationStatusHistory.create).not.toHaveBeenCalled();
    expect(prisma.organizationAuditLog.create).not.toHaveBeenCalled();
  });

  it("rejects email from a final status before contacting SMTP", async () => {
    const prisma = makeQuotationsPrisma({ quotationStatus: QuotationStatus.APPROVED });
    const mailService = {
      isCommercialEmailEnabled: () => true,
      send: jest.fn(async (_message: unknown) => undefined)
    };
    const realService = new QuotationsService(
      prisma as unknown as ConstructorParameters<typeof QuotationsService>[0],
      mailService as unknown as ConstructorParameters<typeof QuotationsService>[1]
    );

    await expect(realService.sendEmail("org-1", "quotation-1", "user-1", {
      to: "cliente@example.com",
      subject: "Cotización",
      message: "Revisa nuestra propuesta."
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(mailService.send).not.toHaveBeenCalled();
  });

  it("reports unavailable mail delivery without writing quotation state", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(
      prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]
    );

    await expect(realService.sendEmail("org-1", "quotation-1", "user-1", {
      to: "cliente@example.com",
      subject: "Cotización",
      message: "Revisa nuestra propuesta."
    })).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(prisma.quotation.update).not.toHaveBeenCalled();
  });

  it("re-sends a sent quotation without changing status and uses safe fallbacks", async () => {
    const prisma = makeQuotationsPrisma({
      quotation: quotation({ status: QuotationStatus.SENT, organization: null })
    });
    const mailService = {
      isCommercialEmailEnabled: () => true,
      send: jest.fn(async (_message: unknown) => undefined)
    };
    const realService = new QuotationsService(
      prisma as unknown as ConstructorParameters<typeof QuotationsService>[0],
      mailService as unknown as ConstructorParameters<typeof QuotationsService>[1]
    );

    await realService.sendEmail("org-1", "quotation-1", "user-1", {
      to: "local-recipient",
      subject: "Quotation",
      message: "Please review.",
      locale: "en"
    });

    expect(prisma.quotation.update).not.toHaveBeenCalled();
    expect(mailService.send).toHaveBeenCalledWith(expect.objectContaining({
      to: "local-recipient",
      text: expect.stringContaining("Kaklen has sent you")
    }));
    expect(prisma.organizationAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ metadata: { recipientDomain: "unknown" } })
    });
  });

  it("rejects quotation creation when its organization no longer exists", async () => {
    const prisma = makeQuotationsPrisma();
    prisma.organization.findFirst.mockImplementationOnce(async () => null as never);
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.create("org-1", "user-1", {
      clientId: "client-1",
      issueDate: "2026-08-01",
      validUntil: "2026-08-31",
      items: [item()]
    })).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.quotation.create).not.toHaveBeenCalled();
  });

  it("rejects percentage discounts over one hundred percent", () => {
    expect(() =>
      service.calculateQuotationItems([
        item({
          discountType: QuotationDiscountType.PERCENTAGE,
          discountValue: 101
        })
      ])
    ).toThrow(BadRequestException);
  });

  it("creates a new version only from versionable statuses", async () => {
    const prisma = makeQuotationsPrisma({ quotationStatus: QuotationStatus.APPROVED });
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await realService.newVersion("org-1", "quotation-1", "user-1");

    expect(callData(prisma.quotation.create)).toMatchObject({
      organizationId: "org-1",
      number: "QUO-000001",
      version: 2,
      status: QuotationStatus.DRAFT,
      items: { create: [expect.objectContaining({ name: "Consulting" })] }
    });

    await expect(
      new QuotationsService(makeQuotationsPrisma() as unknown as ConstructorParameters<typeof QuotationsService>[0]).newVersion(
        "org-1",
        "quotation-1",
        "user-1"
      )
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("starts numbering at one when no numeric latest quotation exists", async () => {
    const probe = service as unknown as NumberProbe;

    await expect(
      probe.nextNumber("org-1", {
        quotation: {
          findFirst: async () => null
        }
      })
    ).resolves.toBe("QUO-000001");
    await expect(
      probe.nextNumber("org-1", {
        quotation: {
          findFirst: async () => ({ number: "QUO-DRAFT" })
        }
      })
    ).resolves.toBe("QUO-000001");
  });

  it("returns history and renders localized PDF labels", async () => {
    const prisma = makeQuotationsPrisma();
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.history("org-1", "quotation-1")).resolves.toHaveLength(1);
    await expect(realService.pdf("org-1", "quotation-1", "pt-BR")).resolves.toBeInstanceOf(Buffer);
    await expect(realService.pdf("org-1", "quotation-1", "unknown")).resolves.toBeInstanceOf(Buffer);
  });

  it("renders English PDFs without optional notes, terms, or organization details", async () => {
    const prisma = makeQuotationsPrisma({ quotation: quotation({ notes: null, terms: null, organization: null }) });
    const realService = new QuotationsService(prisma as unknown as ConstructorParameters<typeof QuotationsService>[0]);

    await expect(realService.pdf("org-1", "quotation-1", "en")).resolves.toBeInstanceOf(Buffer);
  });
});

function item(overrides: Partial<Parameters<QuotationsService["calculateQuotationItems"]>[0][number]> = {}): Parameters<QuotationsService["calculateQuotationItems"]>[0][number] {
  return {
    type: QuotationItemType.CUSTOM,
    name: "Custom item",
    quantity: 1,
    unit: "unit",
    unitPrice: 100,
    discountType: QuotationDiscountType.NONE,
    discountValue: 0,
    taxPercent: 0,
    ...overrides
  };
}

function makeQuotationsPrisma(options: {
  client?: unknown;
  catalogItems?: unknown[];
  quotationStatus?: QuotationStatus;
  quotation?: unknown;
  organizationCurrency?: string;
  approvedByCurrency?: Array<{ currency: string; amount: string; count: number }>;
} = {}) {
  const catalogItems = options.catalogItems ?? [catalogItem()];
  const currentQuotation = options.quotation === undefined ? quotation({ status: options.quotationStatus ?? QuotationStatus.DRAFT }) : options.quotation;
  const tx = {
    organization: {
      findFirst: jest.fn(async () => ({
        id: "org-1",
        name: "Kaklen",
        currency: options.organizationCurrency ?? "CLP",
        deletedAt: null
      }))
    },
    client: {
      findFirst: jest.fn(async () => (options.client === undefined ? { id: "client-1", organizationId: "org-1", archivedAt: null } : options.client))
    },
    catalogItem: {
      findMany: jest.fn(async () => catalogItems)
    },
    quotation: {
      findFirst: jest.fn(async ({ orderBy }: { orderBy?: { createdAt?: string; version?: string } } = {}) => {
        if (orderBy?.createdAt) {
          return quotation({ number: "QUO-000001" });
        }
        if (orderBy?.version) {
          return quotation({ version: 1 });
        }
        return currentQuotation;
      }),
      findMany: jest.fn(async () => [quotation()]),
      count: jest.fn(async () => 1),
      groupBy: jest.fn(async ({ by }: { by: string[] }) => by.includes("currency")
        ? (options.approvedByCurrency ?? [
            { currency: "BRL", amount: "800.00", count: 1 },
            { currency: "CLP", amount: "150000", count: 2 },
            { currency: "EUR", amount: "100.50", count: 1 },
            { currency: "USD", amount: "500.25", count: 1 }
          ]).map((group) => ({
            currency: group.currency,
            _sum: { total: new Prisma.Decimal(group.amount) },
            _count: { _all: group.count }
          }))
        : [
            { status: QuotationStatus.DRAFT, _count: { _all: 1 } },
            { status: QuotationStatus.APPROVED, _count: { _all: 5 } }
          ]),
      create: jest.fn(async () => quotation()),
      update: jest.fn(async () => quotation())
    },
    quotationItem: {
      deleteMany: jest.fn(async () => ({ count: 1 }))
    },
    quotationStatusHistory: {
      create: jest.fn(async () => ({
        id: "history-1",
        organizationId: "org-1",
        quotationId: "quotation-1",
        previousStatus: null,
        newStatus: QuotationStatus.DRAFT,
        changedByUserId: "user-1",
        note: null,
        createdAt: new Date("2026-07-15T00:00:00.000Z")
      })),
      findMany: jest.fn(async () => [
        {
          id: "history-1",
          organizationId: "org-1",
          quotationId: "quotation-1",
          previousStatus: null,
          newStatus: QuotationStatus.DRAFT,
          changedByUserId: "user-1",
          note: null,
          createdAt: new Date("2026-07-15T00:00:00.000Z")
        }
      ])
    },
    quotationChangeRequest: {
      findMany: jest.fn(async () => [{
        id: "change-1",
        organizationId: "org-1",
        quotationId: "quotation-1",
        publicLinkId: "link-1",
        comment: "Cambiar el alcance",
        itemIndexes: [0, 99],
        createdAt: new Date("2026-07-16T00:00:00.000Z"),
        quotation: {
          version: 2,
          items: [{ name: "Historical consulting", code: "HISTORICAL" }]
        }
      }])
    },
    organizationAuditLog: {
      create: jest.fn(async () => ({ id: "audit-1" }))
    }
  };

  return {
    ...tx,
    $transaction: jest.fn(async (input: unknown) => (Array.isArray(input) ? Promise.all(input) : (input as (transaction: typeof tx) => Promise<unknown>)(tx)))
  };
}

function quotation(overrides: Record<string, unknown> = {}) {
  const now = new Date("2026-07-15T00:00:00.000Z");
  return {
    id: "quotation-1",
    organizationId: "org-1",
    clientId: "client-1",
    number: "QUO-000001",
    version: 1,
    status: QuotationStatus.DRAFT,
    issueDate: new Date("2026-08-01T00:00:00.000Z"),
    validUntil: new Date("2026-08-31T00:00:00.000Z"),
    currency: "CLP",
    globalDiscountPercent: new Prisma.Decimal(0),
    subtotal: new Prisma.Decimal(1000),
    discountTotal: new Prisma.Decimal(0),
    taxTotal: new Prisma.Decimal(190),
    total: new Prisma.Decimal(1190),
    notes: "Nota",
    terms: "Terminos",
    createdByUserId: "user-1",
    approvedAt: null,
    rejectedAt: null,
    sentAt: null,
    createdAt: now,
    updatedAt: now,
    archivedAt: null,
    client: { id: "client-1", displayName: "Cliente demo" },
    organization: { id: "org-1", name: "Kaklen" },
    items: [
      {
        id: "item-1",
        quotationId: "quotation-1",
        catalogItemId: "catalog-1",
        type: QuotationItemType.SERVICE,
        code: "CONSULTING",
        name: "Consulting",
        description: "Service",
        quantity: new Prisma.Decimal(1),
        unit: "hour",
        unitPrice: new Prisma.Decimal(1000),
        discountType: QuotationDiscountType.NONE,
        discountValue: new Prisma.Decimal(0),
        taxPercent: new Prisma.Decimal(19),
        subtotal: new Prisma.Decimal(1000),
        discountTotal: new Prisma.Decimal(0),
        taxTotal: new Prisma.Decimal(190),
        total: new Prisma.Decimal(1190),
        sortOrder: 1
      }
    ],
    history: [],
    ...overrides
  };
}

function catalogItem() {
  return {
    id: "catalog-1",
    organizationId: "org-1",
    type: CatalogItemType.SERVICE,
    status: CatalogItemStatus.ACTIVE,
    sku: null,
    code: "CONSULTING",
    name: "Consulting",
    description: "Snapshot",
    unit: "hour",
    cost: new Prisma.Decimal(10),
    price: new Prisma.Decimal(120),
    taxPercent: new Prisma.Decimal(19),
    currency: "CLP",
    trackInventory: false,
    createdByUserId: "user-1",
    createdAt: new Date("2026-07-15T00:00:00.000Z"),
    updatedAt: new Date("2026-07-15T00:00:00.000Z"),
    archivedAt: null
  };
}

function callData(mock: { mock: { calls: unknown[][] } }, callIndex = 0): unknown {
  const call = mock.mock.calls[callIndex]?.[0] as { data?: unknown } | undefined;
  return call?.data;
}
