import { formatCurrency, formatDate, formatNumber, getCurrencySymbol } from "@angular/common";

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
  return formatCurrency(
    Number(value),
    config.numberFormat,
    getCurrencySymbol(config.currency, "narrow"),
    config.currency,
    "1.2-2"
  );
}

export function formatRegionalNumber(
  value: string | number,
  config: Pick<RegionalFormatConfig, "numberFormat"> = DEFAULT_REGIONAL_FORMAT_CONFIG
): string {
  return formatNumber(Number(value), config.numberFormat, "1.0-2");
}
