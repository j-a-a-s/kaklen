import { ConflictException, Logger } from "@nestjs/common";
import {
  assertQuotationMoneyInvariants,
  calculateQuotationMoney,
  moneyToMinorUnits
} from "@kaklen/shared";
import type {
  QuotationMoneyResult,
  SharedQuotationDiscountType
} from "@kaklen/shared";

interface DecimalValue {
  toString(): string;
}

const logger = new Logger("QuotationMoneyConsistency");

export interface PersistedQuotationMoney {
  currency: string;
  globalDiscountPercent: DecimalValue;
  subtotal: DecimalValue;
  discountTotal: DecimalValue;
  taxTotal: DecimalValue;
  total: DecimalValue;
  items: ReadonlyArray<{
    quantity: DecimalValue;
    unitPrice: DecimalValue;
    discountType: SharedQuotationDiscountType;
    discountValue: DecimalValue;
    taxPercent: DecimalValue;
    subtotal: DecimalValue;
    discountTotal: DecimalValue;
    taxTotal: DecimalValue;
    total: DecimalValue;
  }>;
}

export function calculateConsistentQuotationMoney(
  source: PersistedQuotationMoney
): QuotationMoneyResult {
  let calculated: QuotationMoneyResult;
  try {
    calculated = calculateQuotationMoney(
      source.items.map((item) => ({
        quantity: item.quantity.toString(),
        unitPrice: item.unitPrice.toString(),
        discountType: item.discountType,
        discountValue: item.discountValue.toString(),
        taxPercent: item.taxPercent.toString()
      })),
      source.globalDiscountPercent.toString(),
      { currency: source.currency }
    );
  } catch (error) {
    throwNormalizedMismatch(error);
  }
  assertPersistedQuotationMoneyParity(source, calculated);
  return calculated;
}

export function assertPersistedQuotationMoneyParity(
  source: PersistedQuotationMoney,
  calculated: QuotationMoneyResult
): void {
  try {
    assertQuotationMoneyInvariants(calculated, { currency: source.currency });

    const comparisons: Array<[string, string, DecimalValue]> = [
      ["subtotal", calculated.subtotal, source.subtotal],
      ["discountTotal", calculated.discountTotal, source.discountTotal],
      ["taxTotal", calculated.taxTotal, source.taxTotal],
      ["total", calculated.total, source.total]
    ];
    source.items.forEach((item, index) => {
      const line = calculated.lines[index];
      comparisons.push(
        [`items.${index}.subtotal`, line.subtotal, item.subtotal],
        [`items.${index}.discountTotal`, line.discountTotal, item.discountTotal],
        [`items.${index}.taxTotal`, line.taxTotal, item.taxTotal],
        [`items.${index}.total`, line.total, item.total]
      );
    });
    for (const [field, expected, persisted] of comparisons) {
      if (
        moneyToMinorUnits(expected, source.currency, field) !==
        moneyToMinorUnits(persisted.toString(), source.currency, field)
      ) {
        throwMismatch(field);
      }
    }
  } catch (error) {
    throwNormalizedMismatch(error);
  }
}

function throwNormalizedMismatch(error: unknown): never {
  if (error instanceof ConflictException) {
    throw error;
  }
  if (error && typeof error === "object" && "field" in error && typeof error.field === "string") {
    throwMismatch(publicField(error.field));
  }
  throw error;
}

function publicField(field: string): string {
  const lineField = /^lines\[(\d+)\](?:\.(.+))?$/.exec(field);
  if (!lineField) return field;
  return `items.${lineField[1]}${lineField[2] ? `.${lineField[2]}` : ""}`;
}

function throwMismatch(field: string): never {
  logger.error(`Quotation money mismatch field=${field}`);
  throw new ConflictException({
    code: "QUOTATION_MONEY_MISMATCH",
    message: "Quotation totals are inconsistent.",
    field
  });
}
