import { BadRequestException } from "@nestjs/common";
import { MoneyPrecisionError, currencyFractionDigits, parseMoney, validateMoneyPrecision } from "@kaklen/shared";
import type { MoneyDecimalInput } from "@kaklen/shared";

export function assertMoneyPrecision(value: MoneyDecimalInput, currency: string): void {
  if (validateMoneyPrecision(value, currency)) return;
  const precisionError = new MoneyPrecisionError(currency, currencyFractionDigits(currency));
  throw new BadRequestException({
    code: precisionError.code,
    message: precisionError.message
  });
}

export function serializeMoney(value: MoneyDecimalInput, currency: string): string {
  assertMoneyPrecision(value, currency);
  return parseMoney(value, currency);
}
