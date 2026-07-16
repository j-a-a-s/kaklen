export type QuotationDecimalInput = string | number;
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
  discountTotal: string;
  taxableBase: string;
  taxTotal: string;
  total: string;
}

export interface QuotationMoneyResult extends QuotationMoneyAmounts {
  lines: QuotationMoneyAmounts[];
}

const MONEY_SCALE = 2;
const QUANTITY_SCALE = 3;
const PERCENT_SCALE = 2;
const PERCENT_DENOMINATOR = 10_000n;

/**
 * Calculates quotation amounts using scaled integers only. Global discounts
 * apply exclusively to lines without a line-level discount.
 */
export function calculateQuotationMoney(
  lines: readonly QuotationMoneyLineInput[],
  globalDiscountPercent: QuotationDecimalInput = 0
): QuotationMoneyResult {
  const globalDiscount = parseScaled(globalDiscountPercent, PERCENT_SCALE, "globalDiscountPercent");
  assertBetween(globalDiscount, 0n, PERCENT_DENOMINATOR, "globalDiscountPercent");

  const calculatedLines = lines.map((line, index) => calculateLine(line, globalDiscount, index));
  return {
    lines: calculatedLines,
    subtotal: formatMoney(sum(calculatedLines.map((line) => parseScaled(line.subtotal, MONEY_SCALE, "subtotal")))),
    discountTotal: formatMoney(sum(calculatedLines.map((line) => parseScaled(line.discountTotal, MONEY_SCALE, "discountTotal")))),
    taxableBase: formatMoney(sum(calculatedLines.map((line) => parseScaled(line.taxableBase, MONEY_SCALE, "taxableBase")))),
    taxTotal: formatMoney(sum(calculatedLines.map((line) => parseScaled(line.taxTotal, MONEY_SCALE, "taxTotal")))),
    total: formatMoney(sum(calculatedLines.map((line) => parseScaled(line.total, MONEY_SCALE, "total"))))
  };
}

export function moneyToMinorUnits(value: QuotationDecimalInput): string {
  return parseScaled(value, MONEY_SCALE, "money").toString();
}

function calculateLine(
  line: QuotationMoneyLineInput,
  globalDiscount: bigint,
  index: number
): QuotationMoneyAmounts {
  const quantity = parseScaled(line.quantity, QUANTITY_SCALE, `lines[${index}].quantity`);
  const unitPrice = parseScaled(line.unitPrice, MONEY_SCALE, `lines[${index}].unitPrice`);
  const taxPercent = parseScaled(line.taxPercent, PERCENT_SCALE, `lines[${index}].taxPercent`);
  const discountType = line.discountType ?? "NONE";
  const discountValue = parseScaled(line.discountValue ?? 0, discountType === "PERCENTAGE" ? PERCENT_SCALE : MONEY_SCALE, `lines[${index}].discountValue`);

  assertBetween(quantity, 1n, 999_999_999_999_999n, `lines[${index}].quantity`);
  assertBetween(unitPrice, 0n, 99_999_999_999_999n, `lines[${index}].unitPrice`);
  assertBetween(taxPercent, 0n, PERCENT_DENOMINATOR, `lines[${index}].taxPercent`);
  if (discountType === "PERCENTAGE") {
    assertBetween(discountValue, 0n, PERCENT_DENOMINATOR, `lines[${index}].discountValue`);
  } else {
    assertBetween(discountValue, 0n, 99_999_999_999_999n, `lines[${index}].discountValue`);
  }

  const subtotal = roundDivide(quantity * unitPrice, 10n ** BigInt(QUANTITY_SCALE));
  const effectivePercent = discountType === "PERCENTAGE"
    ? discountValue
    : discountType === "NONE"
      ? globalDiscount
      : 0n;
  const requestedDiscount = discountType === "FIXED"
    ? discountValue
    : roundDivide(subtotal * effectivePercent, PERCENT_DENOMINATOR);
  const discountTotal = requestedDiscount > subtotal ? subtotal : requestedDiscount;
  const taxableBase = subtotal - discountTotal;
  const taxTotal = roundDivide(taxableBase * taxPercent, PERCENT_DENOMINATOR);

  return {
    subtotal: formatMoney(subtotal),
    discountTotal: formatMoney(discountTotal),
    taxableBase: formatMoney(taxableBase),
    taxTotal: formatMoney(taxTotal),
    total: formatMoney(taxableBase + taxTotal)
  };
}

function parseScaled(value: QuotationDecimalInput, scale: number, field: string): bigint {
  const source = toPlainDecimal(value).trim();
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

function toPlainDecimal(value: QuotationDecimalInput): string {
  if (typeof value === "string") {
    return value;
  }
  if (!Number.isFinite(value)) {
    return String(value);
  }
  const source = String(value);
  if (!/[eE]/.test(source)) {
    return source;
  }

  const [coefficient, exponentSource] = source.toLowerCase().split("e");
  const exponent = Number(exponentSource);
  const negative = coefficient.startsWith("-");
  const unsigned = coefficient.replace(/^[+-]/, "");
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = `${integer}${fraction}`;
  const decimalIndex = integer.length + exponent;
  const plain = decimalIndex <= 0
    ? `0.${"0".repeat(-decimalIndex)}${digits}`
    : decimalIndex >= digits.length
      ? `${digits}${"0".repeat(decimalIndex - digits.length)}`
      : `${digits.slice(0, decimalIndex)}.${digits.slice(decimalIndex)}`;
  return negative ? `-${plain}` : plain;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function formatMoney(minorUnits: bigint): string {
  const negative = minorUnits < 0n;
  const absolute = negative ? -minorUnits : minorUnits;
  const whole = absolute / 100n;
  const fraction = String(absolute % 100n).padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

function sum(values: readonly bigint[]): bigint {
  return values.reduce((total, value) => total + value, 0n);
}

function assertBetween(value: bigint, minimum: bigint, maximum: bigint, field: string): void {
  if (value < minimum || value > maximum) {
    throw new RangeError(`${field} is outside the supported range`);
  }
}
