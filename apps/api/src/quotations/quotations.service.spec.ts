import { BadRequestException } from "@nestjs/common";
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

    expect(result.subtotal.toFixed(2)).toBe("200.00");
    expect(result.discountTotal.toFixed(2)).toBe("0.00");
    expect(result.taxTotal.toFixed(2)).toBe("38.00");
    expect(result.total.toFixed(2)).toBe("238.00");
  });

  it("calculates percentage discounts", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 1, unitPrice: 1000, discountType: QuotationDiscountType.PERCENTAGE, discountValue: 10, taxPercent: 0 })
    ]);

    expect(result.discountTotal.toFixed(2)).toBe("100.00");
    expect(result.total.toFixed(2)).toBe("900.00");
  });

  it("calculates fixed discounts without going below zero", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 1, unitPrice: 50, discountType: QuotationDiscountType.FIXED, discountValue: 80, taxPercent: 19 })
    ]);

    expect(result.discountTotal.toFixed(2)).toBe("50.00");
    expect(result.total.toFixed(2)).toBe("0.00");
  });

  it("rounds monetary values to two decimals", () => {
    const result = service.calculateQuotationItems([
      item({ quantity: 3, unitPrice: 33.333, taxPercent: 19 })
    ]);

    expect(result.subtotal.toFixed(2)).toBe("100.00");
    expect(result.taxTotal.toFixed(2)).toBe("19.00");
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
    expect(result.items[0]?.unitPrice.toFixed(2)).toBe("120.00");
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
