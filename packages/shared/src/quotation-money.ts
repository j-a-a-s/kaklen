import { MoneyPrecisionError, currencyFractionDigits, decimalSource, validateMoneyPrecision } from "./currency-money.js";
import type { MoneyDecimalInput } from "./currency-money.js";

export type QuotationDecimalInput = MoneyDecimalInput;
export type SharedQuotationDiscountType = "NONE" | "PERCENTAGE" | "FIXED";

export interface QuotationMoneyLineInput {
  quantity: QuotationDecimalInput;
  unitPrice: QuotationDecimalInput;
  discountType?: SharedQuotationDiscountType;
  discountValue?: QuotationDecimalInput;
  taxPercent: QuotationDecimalInput;
}

export interface QuotationMoneyAmounts {
  subtotal: string;
  lineDiscountTotal: string;
  globalDiscountTotal: string;
  discountTotal: string;
  taxableBase: string;
  taxTotal: string;
  total: string;
}

export interface QuotationMoneyResult extends QuotationMoneyAmounts {
  lines: QuotationMoneyAmounts[];
}

interface PreparedLine {
  index: number;
  subtotal: bigint;
  lineDiscount: bigint;
  globalDiscount: bigint;
  taxPercent: bigint;
  eligibleForGlobalDiscount: boolean;
}

const QUANTITY_SCALE = 3;
const PERCENT_SCALE = 2;
const PERCENT_DENOMINATOR = 10_000n;

/**
 * Calculates quotation amounts with scaled integers. A global discount is
 * distributed only among lines without a specific discount. Largest
 * remainders receive residual minor units in source order for deterministic
 * totals across runtimes.
 */
export function calculateQuotationMoney(
  lines: readonly QuotationMoneyLineInput[],
  globalDiscountPercent: QuotationDecimalInput = 0,
  options: { readonly currency: string } = { currency: "USD" }
): QuotationMoneyResult {
  const moneyScale = currencyFractionDigits(options.currency);
  const globalPercent = parseScaled(
    globalDiscountPercent,
    PERCENT_SCALE,
    "globalDiscountPercent"
  );
  assertBetween(globalPercent, 0n, PERCENT_DENOMINATOR, "globalDiscountPercent");

  const prepared = lines.map((line, index) => prepareLine(line, index, moneyScale, options.currency));
  distributeGlobalDiscount(prepared, globalPercent);
  const calculated = prepared.map((line) => finalizeLine(line, moneyScale));

  return {
    lines: calculated,
    subtotal: sumAmount(calculated, "subtotal", moneyScale),
    lineDiscountTotal: sumAmount(calculated, "lineDiscountTotal", moneyScale),
    globalDiscountTotal: sumAmount(calculated, "globalDiscountTotal", moneyScale),
    discountTotal: sumAmount(calculated, "discountTotal", moneyScale),
    taxableBase: sumAmount(calculated, "taxableBase", moneyScale),
    taxTotal: sumAmount(calculated, "taxTotal", moneyScale),
    total: sumAmount(calculated, "total", moneyScale)
  };
}

function prepareLine(
  line: QuotationMoneyLineInput,
  index: number,
  moneyScale: number,
  currency: string
): PreparedLine {
  const quantity = parseScaled(line.quantity, QUANTITY_SCALE, `lines[${index}].quantity`);
  assertMoneyPrecision(line.unitPrice, currency, `lines[${index}].unitPrice`);
  const unitPrice = parseScaled(line.unitPrice, moneyScale, `lines[${index}].unitPrice`);
  const taxPercent = parseScaled(line.taxPercent, PERCENT_SCALE, `lines[${index}].taxPercent`);
  const discountType = line.discountType ?? "NONE";
  const discountValue = parseScaled(
    line.discountValue ?? 0,
    discountType === "PERCENTAGE" ? PERCENT_SCALE : moneyScale,
    `lines[${index}].discountValue`
  );
  if (discountType !== "PERCENTAGE") {
    assertMoneyPrecision(line.discountValue ?? 0, currency, `lines[${index}].discountValue`);
  }

  assertBetween(quantity, 1n, 999_999_999_999_999n, `lines[${index}].quantity`);
  assertBetween(unitPrice, 0n, 99_999_999_999_999n, `lines[${index}].unitPrice`);
  assertBetween(taxPercent, 0n, PERCENT_DENOMINATOR, `lines[${index}].taxPercent`);

  const subtotal = roundDivide(quantity * unitPrice, 10n ** BigInt(QUANTITY_SCALE));
  let lineDiscount = 0n;

  if (discountType === "NONE") {
    if (discountValue !== 0n) {
      throw new RangeError(`lines[${index}].discountValue must be zero when discountType is NONE`);
    }
  } else if (discountType === "PERCENTAGE") {
    assertBetween(discountValue, 0n, PERCENT_DENOMINATOR, `lines[${index}].discountValue`);
    lineDiscount = roundDivide(subtotal * discountValue, PERCENT_DENOMINATOR);
  } else if (discountType === "FIXED") {
    assertBetween(discountValue, 0n, subtotal, `lines[${index}].discountValue`);
    lineDiscount = discountValue;
  } else {
    throw new RangeError(`lines[${index}].discountType is not supported`);
  }

  return {
    index,
    subtotal,
    lineDiscount,
    globalDiscount: 0n,
    taxPercent,
    eligibleForGlobalDiscount: discountType === "NONE"
  };
}

function distributeGlobalDiscount(lines: PreparedLine[], globalPercent: bigint): void {
  const eligible = lines.filter((line) => line.eligibleForGlobalDiscount && line.subtotal > 0n);
  const eligibleSubtotal = sum(eligible.map((line) => line.subtotal));
  if (eligibleSubtotal === 0n || globalPercent === 0n) {
    return;
  }

  const target = roundDivide(eligibleSubtotal * globalPercent, PERCENT_DENOMINATOR);
  const allocations = eligible.map((line) => {
    const numerator = line.subtotal * target;
    return {
      line,
      amount: numerator / eligibleSubtotal,
      remainder: numerator % eligibleSubtotal
    };
  });
  let residual = target - sum(allocations.map((allocation) => allocation.amount));
  allocations.sort(
    (left, right) =>
      compareBigInt(right.remainder, left.remainder) || left.line.index - right.line.index
  );
  for (const allocation of allocations) {
    if (residual === 0n) {
      break;
    }
    allocation.amount += 1n;
    residual -= 1n;
  }
  allocations.forEach((allocation) => {
    allocation.line.globalDiscount = allocation.amount;
  });
}

function finalizeLine(line: PreparedLine, moneyScale: number): QuotationMoneyAmounts {
  const discountTotal = line.lineDiscount + line.globalDiscount;
  const taxableBase = line.subtotal - discountTotal;
  const taxTotal = roundDivide(taxableBase * line.taxPercent, PERCENT_DENOMINATOR);
  return {
    subtotal: formatScaledMoney(line.subtotal, moneyScale),
    lineDiscountTotal: formatScaledMoney(line.lineDiscount, moneyScale),
    globalDiscountTotal: formatScaledMoney(line.globalDiscount, moneyScale),
    discountTotal: formatScaledMoney(discountTotal, moneyScale),
    taxableBase: formatScaledMoney(taxableBase, moneyScale),
    taxTotal: formatScaledMoney(taxTotal, moneyScale),
    total: formatScaledMoney(taxableBase + taxTotal, moneyScale)
  };
}

function sumAmount(
  lines: readonly QuotationMoneyAmounts[],
  field: keyof QuotationMoneyAmounts,
  moneyScale: number
): string {
  return formatScaledMoney(sum(lines.map((line) => parseScaled(line[field], moneyScale, field))), moneyScale);
}

function parseScaled(value: QuotationDecimalInput, scale: number, field: string): bigint {
  const source = decimalSource(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) {
    throw new RangeError(`${field} must be a finite decimal value`);
  }

  const sign = match[1] === "-" ? -1n : 1n;
  const integer = match[2];
  const fraction = match[3] ?? "";
  const keptFraction = fraction.slice(0, scale).padEnd(scale, "0");
  let scaled = BigInt(integer) * 10n ** BigInt(scale) + BigInt(keptFraction || "0");
  const firstDiscardedDigit = fraction[scale];
  if (firstDiscardedDigit && firstDiscardedDigit >= "5") {
    scaled += 1n;
  }
  return scaled * sign;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function formatScaledMoney(minorUnits: bigint, scale: number): string {
  const negative = minorUnits < 0n;
  const absolute = negative ? -minorUnits : minorUnits;
  if (scale === 0) return `${negative ? "-" : ""}${absolute}`;
  const factor = 10n ** BigInt(scale);
  const whole = absolute / factor;
  const fraction = String(absolute % factor).padStart(scale, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function assertMoneyPrecision(value: QuotationDecimalInput, currency: string, field: string): void {
  if (!validateMoneyPrecision(value, currency)) {
    const error = new MoneyPrecisionError(currency, currencyFractionDigits(currency));
    error.message = `${field} has invalid precision for ${currency.toUpperCase()}`;
    throw error;
  }
}

function sum(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

function compareBigInt(left: bigint, right: bigint): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function assertBetween(value: bigint, minimum: bigint, maximum: bigint, field: string): void {
  if (value < minimum || value > maximum) {
    throw new RangeError(`${field} is outside the supported range`);
  }
}
