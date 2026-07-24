export type PaymentsCapabilityMode = "disabled" | "sandbox" | "provider";
export type WhatsAppCapabilityMode = "manual" | "provider";

export interface RuntimeConfig {
  apiBaseUrl: string;
  environment: string;
  version: string;
  commitSha: string;
  buildTime: string;
  sessionIdleSeconds: number;
  sessionWarningSeconds: number;
  commercialEmailEnabled: boolean;
  paymentsMode: PaymentsCapabilityMode;
  whatsappMode: WhatsAppCapabilityMode;
}

interface RuntimeGlobal {
  __KAKLEN_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
}

const runtimeGlobal = globalThis as RuntimeGlobal;

export const RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.apiBaseUrl ?? "http://localhost:3000/api",
  environment: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.environment ?? "development",
  version: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.version ?? "0.1.0",
  commitSha: shortSha(runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.commitSha ?? "local"),
  buildTime: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.buildTime ?? "",
  sessionIdleSeconds: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.sessionIdleSeconds ?? 300,
  sessionWarningSeconds: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.sessionWarningSeconds ?? 240,
  commercialEmailEnabled: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.commercialEmailEnabled ?? false,
  paymentsMode: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.paymentsMode ?? "sandbox",
  whatsappMode: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.whatsappMode ?? "manual"
};

export const API_BASE_URL = RUNTIME_CONFIG.apiBaseUrl.replace(/\/+$/, "");

export function shortSha(value: string): string {
  return value ? value.slice(0, 7) : "local";
}

export async function fetchRuntimeConfig(cacheKey = Date.now().toString()): Promise<RuntimeConfig> {
  const response = await fetch(`/runtime-config.json?build=${encodeURIComponent(cacheKey)}`, {
    cache: "no-store",
    headers: {
      "Cache-Control": "no-store"
    }
  });
  if (!response.ok) {
    throw new Error("Runtime config unavailable");
  }
  const body = (await response.json()) as Partial<RuntimeConfig>;
  return {
    apiBaseUrl: body.apiBaseUrl ?? RUNTIME_CONFIG.apiBaseUrl,
    environment: body.environment ?? RUNTIME_CONFIG.environment,
    version: body.version ?? RUNTIME_CONFIG.version,
    commitSha: shortSha(body.commitSha ?? RUNTIME_CONFIG.commitSha),
    buildTime: body.buildTime ?? RUNTIME_CONFIG.buildTime,
    sessionIdleSeconds: body.sessionIdleSeconds ?? RUNTIME_CONFIG.sessionIdleSeconds,
    sessionWarningSeconds: body.sessionWarningSeconds ?? RUNTIME_CONFIG.sessionWarningSeconds,
    commercialEmailEnabled: body.commercialEmailEnabled ?? RUNTIME_CONFIG.commercialEmailEnabled,
    paymentsMode: body.paymentsMode ?? RUNTIME_CONFIG.paymentsMode,
    whatsappMode: body.whatsappMode ?? RUNTIME_CONFIG.whatsappMode
  };
}
