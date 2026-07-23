export const LEAD_INTERESTS = [
  "ADVISORY",
  "KAKLEN",
  "PLATFORM_DEVELOPMENT",
  "DIGITAL_TRANSFORMATION",
  "INVESTMENT_PARTNERSHIP",
  "KAPIAR",
  "OTHER"
] as const;

export type LeadInterest = (typeof LEAD_INTERESTS)[number];

export const interestOptions: Array<{ value: LeadInterest; label: string }> = [
  { value: "ADVISORY", label: "Solicitar asesoría" },
  { value: "KAKLEN", label: "Conocer Kaklen" },
  { value: "PLATFORM_DEVELOPMENT", label: "Desarrollo de plataforma" },
  { value: "DIGITAL_TRANSFORMATION", label: "Transformación digital" },
  { value: "INVESTMENT_PARTNERSHIP", label: "Inversión o alianza" },
  { value: "KAPIAR", label: "Kapiar" },
  { value: "OTHER", label: "Otro" }
];
