export interface RuntimeConfig {
  apiBaseUrl: string;
  environment: string;
  version: string;
}

interface RuntimeGlobal {
  __KAKLEN_RUNTIME_CONFIG__?: Partial<RuntimeConfig>;
}

const runtimeGlobal = globalThis as RuntimeGlobal;

export const RUNTIME_CONFIG: RuntimeConfig = {
  apiBaseUrl: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.apiBaseUrl ?? "http://localhost:3000/api",
  environment: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.environment ?? "development",
  version: runtimeGlobal.__KAKLEN_RUNTIME_CONFIG__?.version ?? "0.1.0"
};

export const API_BASE_URL = RUNTIME_CONFIG.apiBaseUrl.replace(/\/+$/, "");
