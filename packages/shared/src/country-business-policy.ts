export const SUPPORTED_COUNTRIES = ["CL", "AR", "BR", "MX", "US"] as const;

export type SupportedCountry = (typeof SUPPORTED_COUNTRIES)[number];

export interface CountryBusinessPolicy {
  country: SupportedCountry;
  taxIdRequired: boolean;
  whatsappRequired: boolean;
  defaultCurrency: string;
  defaultTaxPercent: number;
  regionalLocale: string;
  phoneExample: string;
  phonePattern: RegExp;
}

const POLICIES: Readonly<Record<SupportedCountry, CountryBusinessPolicy>> = {
  CL: {
    country: "CL",
    taxIdRequired: true,
    whatsappRequired: true,
    defaultCurrency: "CLP",
    defaultTaxPercent: 19,
    regionalLocale: "es-CL",
    phoneExample: "+56 9 1234 5678",
    phonePattern: /^\+56\d{9}$/
  },
  AR: {
    country: "AR",
    taxIdRequired: false,
    whatsappRequired: false,
    defaultCurrency: "ARS",
    defaultTaxPercent: 21,
    regionalLocale: "es-AR",
    phoneExample: "+54 9 11 1234 5678",
    phonePattern: /^\+54\d{10,13}$/
  },
  BR: {
    country: "BR",
    taxIdRequired: false,
    whatsappRequired: false,
    defaultCurrency: "BRL",
    defaultTaxPercent: 0,
    regionalLocale: "pt-BR",
    phoneExample: "+55 11 91234 5678",
    phonePattern: /^\+55\d{10,11}$/
  },
  MX: {
    country: "MX",
    taxIdRequired: false,
    whatsappRequired: false,
    defaultCurrency: "MXN",
    defaultTaxPercent: 16,
    regionalLocale: "es-MX",
    phoneExample: "+52 55 1234 5678",
    phonePattern: /^\+52\d{10}$/
  },
  US: {
    country: "US",
    taxIdRequired: false,
    whatsappRequired: false,
    defaultCurrency: "USD",
    defaultTaxPercent: 0,
    regionalLocale: "en-US",
    phoneExample: "+1 202 555 0123",
    phonePattern: /^\+1\d{10}$/
  }
};

export function normalizeCountryCode(value: string | null | undefined): SupportedCountry {
  const normalized = value?.trim().toUpperCase();
  return SUPPORTED_COUNTRIES.find((country) => country === normalized) ?? "CL";
}

export function countryBusinessPolicy(
  value: string | null | undefined
): CountryBusinessPolicy {
  return POLICIES[normalizeCountryCode(value)];
}

export function normalizeInternationalPhone(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) {
    return "";
  }
  const normalized = cleaned.replace(/[^\d+]/g, "");
  if (!normalized.startsWith("+") || normalized.slice(1).includes("+")) {
    return "";
  }
  return `+${normalized.slice(1).replace(/\D/g, "")}`;
}

export function isValidCountryPhone(
  value: string | null | undefined,
  country: string | null | undefined
): boolean {
  const normalized = normalizeInternationalPhone(value);
  return normalized.length > 0 && countryBusinessPolicy(country).phonePattern.test(normalized);
}
