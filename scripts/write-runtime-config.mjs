import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const outputPath = process.argv[2] ?? "apps/web/public/runtime-config.js";
const config = {
  apiBaseUrl: process.env.PUBLIC_API_BASE_URL ?? "http://localhost:3000/api",
  environment: process.env.PUBLIC_APP_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
  version: process.env.APP_VERSION ?? process.env.npm_package_version ?? "0.1.0"
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `window.__KAKLEN_RUNTIME_CONFIG__ = ${JSON.stringify(config, null, 2)};\n`);
console.log(`Wrote public runtime config to ${join(process.cwd(), outputPath)}`);
