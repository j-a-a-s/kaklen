#!/usr/bin/env node
import { resolve } from "node:path";
import { createI18nServer } from "./i18n-server.mjs";

const port = positiveInteger(process.env.WEB_PORT, 4200);
const distRoot = resolve(process.env.WEB_DIST_ROOT ?? "apps/web/dist/web");

try {
  const server = createI18nServer({
    distRoot,
    port,
    logRequests: process.env.E2E_WEB_REQUEST_LOGS === "true"
  });
  server.once("error", (error) => {
    console.error(`[e2e:web] ${error.message}`);
    process.exitCode = 1;
  });
  server.listen(port, "0.0.0.0", () => {
    console.log(`[e2e:web] Localized frontend listening on http://localhost:${port}/es/login`);
  });
} catch (error) {
  console.error(`[e2e:web] ${error instanceof Error ? error.message : "No fue posible iniciar el frontend localizado."}`);
  process.exitCode = 1;
}

function positiveInteger(value, fallback) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    throw new Error(`Puerto web inválido: ${value}`);
  }
  return parsed;
}
