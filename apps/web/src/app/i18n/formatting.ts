import { formatDate, formatNumber } from "@angular/common";

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
  const amount = Number(value);
  const locale = config.currency === "CLP" && config.numberFormat.startsWith("es") ? "es-CL" : config.numberFormat;
  const fractionDigits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: config.currency,
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: 2
  }).format(amount);
}

export function formatRegionalNumber(
  value: string | number,
  config: Pick<RegionalFormatConfig, "numberFormat"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  return formatNumber(Number(value), config.numberFormat, "1.0-2");
}
