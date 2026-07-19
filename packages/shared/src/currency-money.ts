export type MoneyDecimalInput = string | number;

export const CURRENCY_FRACTION_DIGITS = {
  CLP: 0,
  USD: 2,
  EUR: 2,
  BRL: 2
} as const;

export type SupportedCurrency = keyof typeof CURRENCY_FRACTION_DIGITS;

export class MoneyValueError extends RangeError {
  constructor(readonly field: string, message: string) {
    super(message);
    this.name = "MoneyValueError";
  }
}

export class MoneyPrecisionError extends RangeError {
  readonly code: "CLP_FRACTION_NOT_ALLOWED" | "MONEY_PRECISION_NOT_ALLOWED";

  constructor(
    readonly currency: string,
    readonly fractionDigits: number,
    readonly field = "amount"
  ) {
    const normalizedCurrency = normalizeCurrency(currency);
    super(
      normalizedCurrency === "CLP"
        ? "CLP amounts cannot contain fractional pesos"
        : `${normalizedCurrency} amounts support at most ${fractionDigits} decimal places`
    );
    this.name = "MoneyPrecisionError";
    this.code = normalizedCurrency === "CLP" ? "CLP_FRACTION_NOT_ALLOWED" : "MONEY_PRECISION_NOT_ALLOWED";
  }
}

export function currencyFractionDigits(currency: string): number {
  const normalized = normalizeCurrency(currency);
  return CURRENCY_FRACTION_DIGITS[normalized as SupportedCurrency] ?? 2;
}

export function currencyStep(currency: string): string {
  const fractionDigits = currencyFractionDigits(currency);
  return fractionDigits === 0 ? "1" : `0.${"0".repeat(fractionDigits - 1)}1`;
}

export function validateMoneyPrecision(value: MoneyDecimalInput, currency: string): boolean {
  const source = decimalSource(value);
  const match = /^[+-]?\d+(?:\.(\d+))?$/.exec(source);
  if (!match) return false;
  const fraction = match[1] ?? "";
  const fractionDigits = currencyFractionDigits(currency);
  return fraction.slice(fractionDigits).split("").every((digit) => digit === "0");
}

export function parseMoney(
  value: MoneyDecimalInput,
  currency: string,
  field = "amount"
): string {
  const fractionDigits = currencyFractionDigits(currency);
  const source = decimalSource(value);
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(source);
  if (!match) throw new MoneyValueError(field, "Money must be a finite decimal value");
  if (!validateMoneyPrecision(source, currency)) {
    throw new MoneyPrecisionError(currency, fractionDigits, field);
  }

  const isZero = /^0+$/.test(match[2]) && /^0*$/.test(match[3] ?? "");
  const sign = match[1] === "-" && !isZero ? "-" : "";
  const integer = stripLeadingZeroes(match[2]);
  if (fractionDigits === 0) return `${sign}${integer}`;
  const fraction = (match[3] ?? "").slice(0, fractionDigits).padEnd(fractionDigits, "0");
  return `${sign}${integer}.${fraction}`;
}

export function moneyToMinorUnits(
  value: MoneyDecimalInput,
  currency: string,
  field = "amount"
): string {
  const fractionDigits = currencyFractionDigits(currency);
  const parsed = parseMoney(value, currency, field);
  const negative = parsed.startsWith("-");
  const unsigned = parsed.replace(/^[+-]/, "");
  const [integer, fraction = ""] = unsigned.split(".");
  const digits = fractionDigits === 0 ? integer : `${integer}${fraction.padEnd(fractionDigits, "0")}`;
  const units = BigInt(digits);
  return (negative ? -units : units).toString();
}

export function minorUnitsToMoney(
  value: bigint | string,
  currency: string,
  field = "amount"
): string {
  const source = typeof value === "bigint" ? value.toString() : value.trim();
  if (!/^[+-]?\d+$/.test(source)) {
    throw new MoneyValueError(field, "Minor units must be an integer value");
  }

  const units = BigInt(source);
  const fractionDigits = currencyFractionDigits(currency);
  const negative = units < 0n;
  const digits = (negative ? -units : units).toString();
  if (fractionDigits === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  const padded = digits.padStart(fractionDigits + 1, "0");
  const decimalIndex = padded.length - fractionDigits;
  return `${negative ? "-" : ""}${padded.slice(0, decimalIndex)}.${padded.slice(decimalIndex)}`;
}

export function formatMoney(value: MoneyDecimalInput, currency: string, locale: string): string {
  const normalizedCurrency = normalizeCurrency(currency);
  const fractionDigits = currencyFractionDigits(normalizedCurrency);
  const parsed = parseMoney(value, normalizedCurrency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(Number(parsed));
}

export function decimalSource(value: MoneyDecimalInput): string {
  if (typeof value === "string") return value.trim();
  if (!Number.isFinite(value)) return String(value);
  const source = String(value);
  if (!/[eE]/.test(source)) return source;

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

function normalizeCurrency(currency: string): string {
  const normalized = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new MoneyValueError("currency", "Currency must be a three-letter ISO code");
  }
  return normalized;
}

function stripLeadingZeroes(value: string): string {
  return value.replace(/^0+(?=\d)/, "");
}
