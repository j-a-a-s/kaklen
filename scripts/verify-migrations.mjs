#!/usr/bin/env node
import pg from "pg";
import {
  buildSchemaDatabaseUrl,
  createVerificationSchemaName,
  findCriticalStructureIssues,
  validateMigrationDirectories
} from "./verify-migrations-core.mjs";
import { checkDatabase, loadLocalEnv, parseDatabaseUrl, readDatabaseUrl, run } from "./local-db-utils.mjs";

const env = loadLocalEnv();
const databaseUrl = readDatabaseUrl(env);
const parsedDatabase = parseDatabaseUrl(databaseUrl);
const schemaName = createVerificationSchemaName();
let schemaCreated = false;

console.log("KAKLEN MIGRATION VERIFY");

try {
  const connection = await checkDatabase(databaseUrl, { timeoutMs: 5000, statementTimeoutMs: 10000 });
  if (!connection.ok) {
    throw new Error(connection.message);
  }
  console.log(`✓ PostgreSQL ${connection.parsed.database}`);

  const migrations = validateMigrationDirectories("prisma/migrations");
  console.log(`✓ Historial SQL: ${migrations.count} migraciones`);

  await createSchema(databaseUrl, schemaName);
  schemaCreated = true;
  console.log(`✓ Schema temporal aislado: ${schemaName}`);

  const isolatedDatabaseUrl = buildSchemaDatabaseUrl(databaseUrl, schemaName);
  const isolatedEnv = { ...env, DATABASE_URL: isolatedDatabaseUrl, NODE_ENV: "development" };

  await runStep("Prisma schema", "pnpm", ["exec", "prisma", "validate"], isolatedEnv);
  if (process.env.MIGRATION_REUSE_PRISMA_CLIENT === "true") {
    console.log("✓ Prisma Client reutilizado");
  } else {
    await runStep("Prisma Client", "pnpm", ["prisma:generate"], isolatedEnv, 120000);
  }
  await runStep("Migraciones desde cero", "pnpm", ["exec", "prisma", "migrate", "deploy"], isolatedEnv, 180000);
  await runStep("Estado de migraciones", "pnpm", ["exec", "prisma", "migrate", "status"], isolatedEnv, 120000);

  const snapshot = await inspectSchema(isolatedDatabaseUrl, schemaName);
  verifyAppliedMigrations(snapshot.migrations, migrations.names);
  console.log(`✓ Migraciones aplicadas: ${snapshot.migrations.length}`);

  const structureIssues = findCriticalStructureIssues(snapshot);
  if (structureIssues.length > 0) {
    throw new Error(["La estructura crítica no coincide:", ...structureIssues.map((issue) => `- ${issue}`)].join("\n"));
  }
  console.log(`✓ Estructura crítica: ${snapshot.tables.length} tablas, ${snapshot.indexes.length} índices`);

  await verifyPrismaDrift(isolatedDatabaseUrl, isolatedEnv);
  console.log("✓ Historial y schema.prisma sincronizados");

  if (process.env.MIGRATION_REUSE_DEMO_VERIFICATION === "true") {
    console.log("✓ Dataset demo delegado a las tareas canónicas del pipeline");
  } else {
    await runStep("Seed demo aislado", "pnpm", ["db:seed:demo"], isolatedEnv, 180000);
    await runStep("Dataset demo aislado", "pnpm", ["db:verify:demo"], isolatedEnv, 120000);
  }

  console.log("\nMIGRATION VERIFICATION PASSED");
} catch (error) {
  console.error("\nMIGRATION VERIFICATION FAILED");
  console.error(redact(error instanceof Error ? error.message : "No fue posible verificar las migraciones."));
  process.exitCode = 1;
} finally {
  if (schemaCreated) {
    try {
      await dropSchema(databaseUrl, schemaName);
      console.log(`✓ Schema temporal eliminado: ${schemaName}`);
    } catch (error) {
      console.error(`✗ No fue posible eliminar el schema temporal ${schemaName}: ${redact(error instanceof Error ? error.message : "error desconocido")}`);
      process.exitCode = 1;
    }
  }
}

async function createSchema(connectionString, name) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA ${quoteIdentifier(name)}`);
  } finally {
    await client.end();
  }
}

async function dropSchema(connectionString, name) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${quoteIdentifier(name)} CASCADE`);
  } finally {
    await client.end();
  }
}

async function inspectSchema(connectionString, name) {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 5000 });
  await client.connect();
  try {
    const tables = await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema = $1 ORDER BY table_name", [name]);
    const columns = await client.query(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = $1 ORDER BY table_name, ordinal_position",
      [name]
    );
    const indexes = await client.query("SELECT indexname FROM pg_indexes WHERE schemaname = $1 ORDER BY indexname", [name]);
    const migrations = await client.query(
      `SELECT migration_name, finished_at, rolled_back_at FROM ${quoteIdentifier(name)}."_prisma_migrations" ORDER BY started_at`
    );
    return {
      tables: tables.rows.map((row) => String(row.table_name)),
      columns: columns.rows.map((row) => ({ table: String(row.table_name), column: String(row.column_name) })),
      indexes: indexes.rows.map((row) => String(row.indexname)),
      migrations: migrations.rows.map((row) => ({
        name: String(row.migration_name),
        finished: row.finished_at !== null,
        rolledBack: row.rolled_back_at !== null
      }))
    };
  } finally {
    await client.end();
  }
}

function verifyAppliedMigrations(appliedMigrations, expectedNames) {
  const appliedNames = appliedMigrations.filter((migration) => migration.finished && !migration.rolledBack).map((migration) => migration.name);
  const incomplete = appliedMigrations.filter((migration) => !migration.finished || migration.rolledBack).map((migration) => migration.name);
  const missing = expectedNames.filter((name) => !appliedNames.includes(name));
  const unexpected = appliedNames.filter((name) => !expectedNames.includes(name));

  if (incomplete.length > 0 || missing.length > 0 || unexpected.length > 0) {
    const details = [
      ...incomplete.map((name) => `migración incompleta o revertida: ${name}`),
      ...missing.map((name) => `migración no aplicada: ${name}`),
      ...unexpected.map((name) => `migración inesperada: ${name}`)
    ];
    throw new Error(["El historial aplicado no coincide:", ...details.map((detail) => `- ${detail}`)].join("\n"));
  }
}

async function verifyPrismaDrift(isolatedDatabaseUrl, isolatedEnv) {
  try {
    await run(
      "pnpm",
      ["exec", "prisma", "migrate", "diff", "--from-url", isolatedDatabaseUrl, "--to-schema-datamodel", "prisma/schema.prisma", "--exit-code"],
      { env: isolatedEnv, timeoutMs: 120000, maxBuffer: 4 * 1024 * 1024 }
    );
  } catch (error) {
    if (Number(error?.code) === 2) {
      const output = redact(`${error?.stdout ?? ""}\n${error?.stderr ?? ""}`.trim());
      throw new Error(`El historial de migraciones no coincide con schema.prisma.${output ? `\n${output}` : ""}`);
    }
    throw commandError("Comparación Prisma", error);
  }
}

async function runStep(label, command, args, commandEnv, timeoutMs = 60000) {
  try {
    await run(command, args, { env: commandEnv, timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    console.log(`✓ ${label}`);
  } catch (error) {
    throw commandError(label, error);
  }
}

function commandError(label, error) {
  const output = redact(`${error?.stdout ?? ""}\n${error?.stderr ?? ""}`.trim());
  return new Error(`${label} falló.${output ? `\n${output}` : ""}`);
}

function quoteIdentifier(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function redact(value) {
  let redacted = value;
  if (databaseUrl) {
    redacted = redacted.replaceAll(databaseUrl, "[DATABASE_URL]");
  }
  if (parsedDatabase?.password) {
    redacted = redacted.replaceAll(parsedDatabase.password, "[REDACTED]");
    redacted = redacted.replaceAll(encodeURIComponent(parsedDatabase.password), "[REDACTED]");
  }
  return redacted;
}
