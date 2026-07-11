#!/usr/bin/env node
import {
  checkDatabase,
  commandOk,
  compareDatabaseUrlWithContainer,
  createDatabaseIfMissing,
  formatDatabaseTargetDetails,
  inspectPostgresContainerEnv,
  isMigrationDriftOutput,
  loadLocalEnv,
  parseDatabaseUrl,
  readDatabaseUrl,
  setupFailureMessage,
  run,
  suggestionForCheck,
  summarizeCommandFailure,
  tableCount
} from "./local-db-utils.mjs";

async function main() {
  console.log("KAKLEN SETUP");
  console.log("");

  await requireCommand("Docker", "docker", ["--version"], "Docker no esta disponible.");
  await requireCommand("Docker Compose", "docker", ["compose", "version"], "Docker Compose no esta disponible.");
  await requireCommand("Docker daemon", "docker", ["info"], "Docker esta instalado pero el daemon no esta activo. Abra Docker Desktop y vuelva a ejecutar pnpm run setup.");

  const env = loadLocalEnv();
  const databaseUrl = readDatabaseUrl(env);
  const parsed = parseDatabaseUrl(databaseUrl);
  console.log("DATABASE_URL");
  formatDatabaseTargetDetails(parsed, env.DATABASE_SSL ?? "false").forEach((line) => console.log(`  ${line}`));

  const containerEnv = await inspectPostgresContainerEnv();
  if (containerEnv) {
    const comparison = compareDatabaseUrlWithContainer(databaseUrl, containerEnv);
    if (!comparison.matches) {
      console.error("✗ Las credenciales de DATABASE_URL no coinciden con el contenedor PostgreSQL activo.");
      console.error(`  usuario esperado: ${containerEnv.user}`);
      console.error(`  base esperada: ${containerEnv.database}`);
      console.error(`  host: ${comparison.parsed?.host ?? "desconocido"}`);
      console.error(`  port: ${comparison.parsed?.port ?? "desconocido"}`);
      comparison.mismatches.forEach((item) => console.error(`  - ${item}`));
      console.error("");
      console.error("Actualice .env o recree el contenedor local con docker compose.");
      process.exit(1);
    }
  }

  let check = await waitForDatabase(databaseUrl);
  if (!check.ok && ["unavailable", "timeout"].includes(check.type)) {
    console.log("PostgreSQL no responde todavia. Levantando servicio local con Docker Compose...");
    try {
      await run("docker", ["compose", "up", "-d", "postgres"], { timeoutMs: 60000 });
    } catch (error) {
      console.error("✗ No fue posible levantar PostgreSQL con Docker Compose.");
      const detail = firstNonEmptyLine(`${error?.stderr ?? ""}\n${error?.stdout ?? ""}\n${error?.message ?? ""}`);
      if (detail) {
        console.error(`Detalle: ${detail}`);
      }
      console.error("Sugerencia: abra Docker Desktop y ejecute pnpm run setup nuevamente.");
      process.exit(1);
    }
    check = await waitForDatabase(databaseUrl);
  }

  if (!check.ok && check.type === "auth") {
    console.error(`✗ ${setupFailureMessage(check)}`);
    process.exit(1);
  }

  if (!check.ok && check.type === "missing-db") {
    console.log(`✗ La base de datos ${check.parsed.database} no existe.`);
    console.log("Intentando crearla con las credenciales configuradas...");
    await createDatabaseIfMissing(databaseUrl);
    check = await waitForDatabase(databaseUrl);
  }

  if (!check.ok) {
    console.error(`✗ ${check.message}`);
    console.error("");
    console.error("Sugerencia:");
    console.error(suggestionForCheck(check));
    process.exit(1);
  }

  console.log("✓ PostgreSQL disponible");
  console.log("✓ Credenciales válidas");
  console.log(`✓ Base de datos ${check.parsed.database}`);
  console.log("Generando Prisma Client...");
  await runRequired("pnpm", ["prisma:generate"], { timeoutMs: 60000, env: { DATABASE_URL: databaseUrl } }, "No fue posible generar Prisma Client.");
  console.log("✓ Prisma Client");

  console.log("Ejecutando migraciones Prisma...");
  await runRequired("pnpm", ["prisma:migrate"], { timeoutMs: 120000, env: { DATABASE_URL: databaseUrl } }, "No fue posible aplicar migraciones Prisma.");
  console.log("✓ Migraciones aplicadas");

  const count = await tableCount(databaseUrl);
  if (count <= 0) {
    console.error("✗ No se encontraron tablas en public despues de migrar.");
    process.exit(1);
  }

  console.log(`✓ Tablas accesibles: ${count}`);
  console.log("");
  console.log("Proyecto listo para ejecutar.");
  console.log("");
  console.log("Siguiente paso:");
  console.log("pnpm dev");
}

async function requireCommand(label, command, args, message) {
  const result = await commandOk(command, args);
  if (!result.ok) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${label}`);
}

async function waitForDatabase(databaseUrl) {
  let last = await checkDatabase(databaseUrl);
  for (let attempt = 0; attempt < 10 && !last.ok && ["unavailable", "timeout"].includes(last.type); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    last = await checkDatabase(databaseUrl);
  }
  return last;
}

async function runRequired(command, args, options, message) {
  try {
    return await run(command, args, options);
  } catch (error) {
    const lines = summarizeCommandFailure(error);
    const output = lines.join("\n");
    console.error(`✗ ${message}`);
    if (isMigrationDriftOutput(output)) {
      console.error("La base local tiene un historial de migraciones que no coincide con prisma/migrations.");
      console.error("Sugerencia: si no necesita conservar esos datos locales, ejecute prisma migrate reset y luego pnpm run setup.");
      process.exit(1);
    }
    lines.slice(0, 8).forEach((line) => console.error(line));
    process.exit(1);
  }
}

await main().catch((error) => {
  console.error("✗ No fue posible preparar el entorno local.");
  if (process.env.LOG_LEVEL === "debug") {
    console.error(error);
  }
  process.exit(1);
});

function firstNonEmptyLine(output) {
  return output.split(/\r?\n/).find((line) => line.trim().length > 0)?.trim() ?? "";
}
