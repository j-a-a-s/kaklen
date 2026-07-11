#!/usr/bin/env node
import {
  buildDatabaseUrlFromParts,
  checkDatabase,
  commandOk,
  createDatabaseIfMissing,
  inspectPostgresContainerEnv,
  readDatabaseUrl,
  run,
  suggestionForCheck,
  tableCount,
  updateEnvDatabaseUrl
} from "./local-db-utils.mjs";

async function main() {
  console.log("Verificando entorno local...");

  await requireCommand("Docker", "docker", ["--version"], "Docker no esta disponible.");
  await requireCommand("Docker Compose", "docker", ["compose", "version"], "Docker Compose no esta disponible.");
  await requireCommand("Docker daemon", "docker", ["info"], "Docker esta instalado pero el daemon no esta activo. Abra Docker Desktop y vuelva a ejecutar pnpm run setup.");

  console.log("Levantando PostgreSQL local si es necesario...");
  try {
    await run("docker", ["compose", "up", "-d", "postgres"], { timeoutMs: 60000 });
  } catch {
    console.error("✗ No fue posible levantar PostgreSQL con Docker Compose.");
    console.error("Sugerencia: abra Docker Desktop y ejecute pnpm run setup nuevamente.");
    process.exit(1);
  }

  let databaseUrl = readDatabaseUrl();
  let check = await waitForDatabase(databaseUrl);

  if (!check.ok && check.type === "auth") {
    console.log("Credenciales invalidas. Buscando credenciales reales del contenedor PostgreSQL...");
    const containerEnv = await inspectPostgresContainerEnv();
    if (containerEnv) {
      const candidate = buildDatabaseUrlFromParts(databaseUrl, containerEnv);
      const candidateCheck = await waitForDatabase(candidate);
      if (candidateCheck.ok || candidateCheck.type === "missing-db") {
        updateEnvDatabaseUrl(candidate);
        databaseUrl = candidate;
        check = candidateCheck;
        console.log("✓ .env actualizado con las credenciales del contenedor local");
      }
    }
  }

  if (!check.ok && check.type === "missing-db") {
    console.log(`La base ${check.parsed.database} no existe. Intentando crearla...`);
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

  console.log("✓ PostgreSQL listo");
  console.log("Generando Prisma Client...");
  await run("pnpm", ["prisma:generate"], { timeoutMs: 60000 });

  console.log("Ejecutando migraciones Prisma...");
  await run("pnpm", ["prisma:migrate"], { timeoutMs: 120000 });

  const count = await tableCount(databaseUrl);
  if (count <= 0) {
    console.error("✗ No se encontraron tablas en public despues de migrar.");
    process.exit(1);
  }

  console.log(`✓ Tablas verificadas: ${count}`);
  console.log("");
  console.log("Proyecto listo para ejecutar.");
}

async function requireCommand(label, command, args, message) {
  const result = await commandOk(command, args);
  if (!result.ok) {
    console.error(`✗ ${message}`);
    process.exit(1);
  }
  console.log(`✓ ${label} disponible`);
}

async function waitForDatabase(databaseUrl) {
  let last = await checkDatabase(databaseUrl);
  for (let attempt = 0; attempt < 10 && !last.ok && ["unavailable", "timeout"].includes(last.type); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    last = await checkDatabase(databaseUrl);
  }
  return last;
}

await main().catch((error) => {
  console.error("✗ No fue posible preparar el entorno local.");
  if (process.env.LOG_LEVEL === "debug") {
    console.error(error);
  }
  process.exit(1);
});
