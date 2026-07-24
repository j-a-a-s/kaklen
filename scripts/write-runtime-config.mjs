import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildInfo } from "./build-info.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const PAYMENTS_MODES = ["disabled", "sandbox", "provider"];
const WHATSAPP_MODES = ["manual", "provider"];

export function createRuntimeConfig() {
  const buildInfo = createBuildInfo();
  return {
    apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
    environment: buildInfo.environment,
    version: buildInfo.version,
    commitSha: buildInfo.commitSha,
    buildTime: buildInfo.buildTime,
    sessionIdleSeconds: readPositiveInteger(process.env.SESSION_IDLE_SECONDS, 300),
    sessionWarningSeconds: readPositiveInteger(process.env.SESSION_WARNING_SECONDS, 240),
    commercialEmailEnabled: process.env.COMMERCIAL_EMAIL_ENABLED === "true",
    // Public, non-sensitive capability flags — mirrors the same modes and
    // production-safe default (readProductIntegrationsConfig in
    // packages/config) so the built frontend never advertises a payment or
    // WhatsApp capability the API isn't actually offering.
    paymentsMode: readMode(process.env.PAYMENT_GATEWAY, PAYMENTS_MODES, buildInfo.environment === "production" ? "disabled" : "sandbox", "PAYMENT_GATEWAY"),
    whatsappMode: readMode(process.env.WHATSAPP_MODE, WHATSAPP_MODES, "manual", "WHATSAPP_MODE")
  };
}

function readMode(value, allowed, fallback, key) {
  if (value === undefined) {
    return fallback;
  }
  if (!allowed.includes(value)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function readPositiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Runtime duration configuration must use positive integers");
  }
  return parsed;
}

export function writeRuntimeConfig(outputPath = "apps/web/public/runtime-config.js") {
  const config = createRuntimeConfig();
  const resolvedOutputPath = resolve(repoRoot, outputPath);
  const jsonPath = resolvedOutputPath.endsWith(".json") ? resolvedOutputPath : resolvedOutputPath.replace(/\.js$/, ".json");

  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  writeFileSync(resolvedOutputPath, `window.__KAKLEN_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
  writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`);
  return { outputPath: resolvedOutputPath, jsonPath, config };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = process.argv[2] ?? "apps/web/public/runtime-config.js";
  const result = writeRuntimeConfig(outputPath);
  console.log(`Wrote public runtime config to ${result.outputPath}`);
  console.log(`Wrote public runtime config JSON to ${result.jsonPath}`);
}
