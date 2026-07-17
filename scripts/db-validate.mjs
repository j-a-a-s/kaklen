#!/usr/bin/env node
import { checkDatabase, loadLocalEnv, readDatabaseUrl, run, tableCount } from "./local-db-utils.mjs";

const env = loadLocalEnv();
const databaseUrl = readDatabaseUrl(env);

try {
  console.log("KAKLEN DB VALIDATE");

  const check = await checkDatabase(databaseUrl);
  if (!check.ok) {
    throw new Error(check.message);
  }
  console.log(`✓ PostgreSQL ${check.parsed.database}`);

  if (process.env.DB_SKIP_PRISMA_GENERATE === "true") {
    console.log("✓ Prisma Client reutilizado");
  } else {
    await run("pnpm", ["prisma:generate"], { env, timeoutMs: 60000 });
    console.log("✓ Prisma Client");
  }

  await run("pnpm", ["exec", "prisma", "validate"], { env, timeoutMs: 60000 });
  console.log("✓ Prisma schema");

  await run("pnpm", ["db:status"], { env, timeoutMs: 60000 });
  console.log("✓ Migraciones Prisma");

  const count = await tableCount(databaseUrl);
  if (count <= 0) {
    throw new Error("No hay tablas accesibles en el schema public.");
  }
  console.log(`✓ Tablas accesibles: ${count}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible validar la base de datos.");
  process.exit(1);
}
