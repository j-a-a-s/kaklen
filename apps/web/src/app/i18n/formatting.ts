import { formatDate, formatNumber } from "@angular/common";
import { currencyFractionDigits, formatMoney, parseMoney } from "@kaklen/shared";

export interface RegionalFormatConfig {
  dateFormat: string;
  numberFormat: string;
  currency: string;
}

export const DEFAULT_REGIONAL_FORMAT_CONFIG: RegionalFormatConfig = {
  dateFormat: "dd-MM-yyyy",
  numberFormat: "es",
  currency: "CLP"
};

export function formatRegionalDate(
  value: string | Date,
  config: Pick<RegionalFormatConfig, "dateFormat" | "numberFormat"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  return formatDate(value, config.dateFormat, config.numberFormat);
}

export function formatRegionalCurrency(
  value: string | number,
  config: Pick<RegionalFormatConfig, "numberFormat" | "currency"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  const locale = currencyFractionDigits(config.currency) === 0 && config.numberFormat.startsWith("es")
    ? "es-CL"
    : config.numberFormat;
  return formatMoney(value, config.currency, locale);
}

export function formatRegionalMoneyValue(
  value: string | number,
  config: Pick<RegionalFormatConfig, "numberFormat" | "currency"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  const fractionDigits = currencyFractionDigits(config.currency);
  return formatNumber(
    Number(parseMoney(value, config.currency)),
    config.numberFormat,
    `1.${fractionDigits}-${fractionDigits}`
  );
}

export function formatRegionalNumber(
  value: string | number,
  config: Pick<RegionalFormatConfig, "numberFormat"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  return formatNumber(Number(value), config.numberFormat, "1.0-2");
}
