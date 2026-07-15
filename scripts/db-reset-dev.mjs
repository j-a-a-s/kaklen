#!/usr/bin/env node
import { loadLocalEnv, parseDatabaseUrl, readDatabaseUrl, run } from "./local-db-utils.mjs";

const env = loadLocalEnv();
const databaseUrl = readDatabaseUrl(env);
const parsed = parseDatabaseUrl(databaseUrl);
const confirmation = process.argv.includes("--confirm") ? process.argv[process.argv.indexOf("--confirm") + 1] : process.env.KAKLEN_CONFIRM_DB_RESET;

if (env.NODE_ENV === "production" || env.PUBLIC_APP_ENVIRONMENT === "production") {
  console.error("db:reset:dev no puede ejecutarse en production.");
  process.exit(1);
}

if (!parsed || !["localhost", "127.0.0.1"].includes(parsed.host)) {
  console.error("db:reset:dev solo puede ejecutarse contra localhost.");
  process.exit(1);
}

if (confirmation !== "reset-dev") {
  console.error("Reset cancelado. Ejecuta: pnpm db:reset:dev -- --confirm reset-dev");
  process.exit(1);
}

try {
  console.log("KAKLEN DB RESET DEV");
  await run("pnpm", ["exec", "prisma", "migrate", "reset", "--force", "--skip-seed"], { env, timeoutMs: 120000 });
  console.log("✓ Migraciones recreadas");
  await run("pnpm", ["db:seed"], { env, timeoutMs: 120000 });
  console.log("✓ Seed local aplicado");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible resetear la base local.");
  process.exit(1);
}
