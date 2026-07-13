import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createBuildInfo } from "./build-info.mjs";

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
  const jsonPath = outputPath.endsWith(".json") ? outputPath : outputPath.replace(/\.js$/, ".json");

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `window.__KAKLEN_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
  writeFileSync(jsonPath, `${JSON.stringify(config, null, 2)}\n`);
  return { outputPath, jsonPath, config };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outputPath = process.argv[2] ?? "apps/web/public/runtime-config.js";
  const result = writeRuntimeConfig(outputPath);
  console.log(`Wrote public runtime config to ${join(process.cwd(), result.outputPath)}`);
  console.log(`Wrote public runtime config JSON to ${join(process.cwd(), result.jsonPath)}`);
}
