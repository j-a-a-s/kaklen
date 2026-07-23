import type { ContactFormValues } from "./validation";

export interface SubmitLeadResult {
  success: true;
  leadReference: string;
  whatsapp: { scheduled: boolean };
}

export interface SubmitLeadError {
  success: false;
  code: string;
  message: string;
}

export type SubmitLeadResponse = SubmitLeadResult | SubmitLeadError;

interface SubmitLeadMeta {
  landingPage?: string;
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000/api";
const MAX_RESPONSE_BYTES = 32_768;
export const SUBMIT_LEAD_TIMEOUT_MS = 10_000;

const GENERIC_ERROR: SubmitLeadError = {
  success: false,
  code: "NETWORK_ERROR",
  message: "No pudimos enviar tu solicitud. Verifica tu conexión e intenta nuevamente."
};

const TIMEOUT_ERROR: SubmitLeadError = {
  success: false,
  code: "REQUEST_TIMEOUT",
  message: "El servidor está tardando demasiado. Intenta nuevamente en unos minutos."
};

const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  BAD_REQUEST: "Revisa los datos ingresados e intenta nuevamente.",
  VALIDATION_ERROR: "Revisa los datos ingresados e intenta nuevamente.",
  PRIVACY_CONSENT_REQUIRED: "Debes aceptar la política de privacidad.",
  LEAD_PHONE_INVALID: "Ingresa un teléfono válido para el país seleccionado.",
  TOO_MANY_REQUESTS: "Recibimos varios intentos. Espera un minuto antes de volver a enviar.",
  RATE_LIMIT_BACKEND_UNAVAILABLE: "El servicio no está disponible temporalmente. Intenta más tarde.",
  INTERNAL_SERVER_ERROR: "El servicio no está disponible temporalmente. Intenta más tarde."
};

export async function submitLead(
  values: ContactFormValues,
  meta: SubmitLeadMeta = {},
  timeoutMs = SUBMIT_LEAD_TIMEOUT_MS
): Promise<SubmitLeadResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;

  try {
    response = await fetch(`${resolveApiBaseUrl(API_BASE_URL)}/leads`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneCountryCode: values.countryCode,
        phone: values.phone,
        company: values.company || undefined,
        position: values.position || undefined,
        country: values.country || undefined,
        interestType: values.interestType,
        message: values.message,
        privacyConsent: values.privacyConsent,
        whatsappConsent: values.whatsappConsent,
        website: values.website || undefined,
        ...normalizeMeta(meta)
      }),
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal
    });
  } catch (error) {
    return isAbortError(error) ? TIMEOUT_ERROR : GENERIC_ERROR;
  } finally {
    clearTimeout(timeout);
  }

  const raw = await parseResponse(response);
  if (!raw) {
    return GENERIC_ERROR;
  }

  if (!response.ok) {
    const code = typeof raw.code === "string" ? raw.code : GENERIC_ERROR.code;
    return {
      success: false,
      code,
      message: ERROR_MESSAGES[code] ?? GENERIC_ERROR.message
    };
  }

  return isSubmitLeadResult(raw) ? raw : GENERIC_ERROR;
}

function resolveApiBaseUrl(value: string): string {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new Error("NEXT_PUBLIC_API_BASE_URL must be an HTTP(S) URL without credentials");
  }
  return parsed.toString().replace(/\/$/u, "");
}

function normalizeMeta(meta: SubmitLeadMeta): SubmitLeadMeta {
  return {
    landingPage: safeMeta(meta.landingPage, 200, /^\/(?!\/)/u),
    referrer: safeReferrer(meta.referrer),
    utmSource: safeMeta(meta.utmSource, 120),
    utmMedium: safeMeta(meta.utmMedium, 120),
    utmCampaign: safeMeta(meta.utmCampaign, 120),
    utmContent: safeMeta(meta.utmContent, 120)
  };
}

function safeMeta(value: string | undefined, maxLength: number, pattern?: RegExp): string | undefined {
  const normalized = value?.trim();
  if (
    !normalized ||
    normalized.length > maxLength ||
    /[\u0000-\u001f\u007f<>]/u.test(normalized) ||
    (pattern && !pattern.test(normalized))
  ) {
    return undefined;
  }
  return normalized;
}

function safeReferrer(value: string | undefined): string | undefined {
  const normalized = safeMeta(value, 500);
  if (!normalized) {
    return undefined;
  }

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return undefined;
    }
    parsed.username = "";
    parsed.password = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return undefined;
  }
}

async function parseResponse(response: Response): Promise<Record<string, unknown> | null> {
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  const text = await response.text().catch(() => "");
  if (!text || text.length > MAX_RESPONSE_BYTES) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function isSubmitLeadResult(value: unknown): value is SubmitLeadResult {
  if (!isRecord(value)) {
    return false;
  }
  const whatsapp = value.whatsapp;
  return (
    value.success === true &&
    typeof value.leadReference === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
      value.leadReference
    ) &&
    isRecord(whatsapp) &&
    typeof whatsapp.scheduled === "boolean"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}
