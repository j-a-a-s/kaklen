import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createBuildInfo } from "./build-info.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function createRuntimeConfig() {
  const buildInfo = createBuildInfo();
  return {
    apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
    environment: buildInfo.environment,
    version: buildInfo.version,
    commitSha: buildInfo.commitSha,
    buildTime: buildInfo.buildTime
  };
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
