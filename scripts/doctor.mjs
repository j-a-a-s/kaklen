#!/usr/bin/env node
import {
  checkDatabase,
  commandOk,
  formatDatabaseTarget,
  loadLocalEnv,
  parseDatabaseUrl,
  readDatabaseUrl,
  suggestionForCheck
} from "./local-db-utils.mjs";

const errors = [];
const warnings = [];

async function checkCommand(label, command, args) {
  const result = await commandOk(command, args);
  if (result.ok) {
    console.log(`✓ ${label}: ${firstLine(result.output)}`);
  } else {
    console.log(`✗ ${label} no disponible`);
    errors.push(`${label} no esta disponible.`);
  }
}

await checkCommand("Node", "node", ["--version"]);
await checkCommand("PNPM", "pnpm", ["--version"]);
await checkCommand("Docker", "docker", ["--version"]);
await checkCommand("Docker Compose", "docker", ["compose", "version"]);
const dockerDaemon = await commandOk("docker", ["info"]);
if (dockerDaemon.ok) {
  console.log("✓ Docker daemon activo");
} else {
  console.log("✗ Docker daemon no esta activo");
  errors.push("Abra Docker Desktop o inicie el servicio Docker antes de ejecutar pnpm run setup.");
}

const env = loadLocalEnv();
const databaseUrl = readDatabaseUrl(env);
const parsed = parseDatabaseUrl(databaseUrl);
if (parsed) {
  console.log(`✓ DATABASE_URL: ${formatDatabaseTarget(parsed)}`);
} else {
  console.log("✗ DATABASE_URL invalida");
  errors.push("DATABASE_URL no es valida.");
}

const critical = [
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "AUTH_ALLOWED_ORIGINS",
  "COOKIE_SECURE",
  "ORGANIZATION_INVITATION_EXPIRES_SECONDS",
  "APP_WEB_URL"
];
for (const key of critical) {
  if (env[key]) {
    console.log(`✓ ${key}`);
  } else {
    console.log(`✗ ${key} no definido`);
    errors.push(`${key} no esta definido.`);
  }
}

if ((env.JWT_ACCESS_SECRET ?? "").length < 32) {
  warnings.push("JWT_ACCESS_SECRET deberia tener al menos 32 caracteres.");
}
if ((env.JWT_REFRESH_SECRET ?? "").length < 32) {
  warnings.push("JWT_REFRESH_SECRET deberia tener al menos 32 caracteres.");
}

const db = await checkDatabase(databaseUrl);
if (db.ok) {
  console.log("✓ PostgreSQL encontrado");
} else {
  console.log(`✗ PostgreSQL: ${db.message}`);
  errors.push(`${db.message} ${suggestionForCheck(db)}`);
}

const prisma = await commandOk("pnpm", ["exec", "prisma", "--version"]);
if (prisma.ok) {
  console.log("✓ Prisma disponible");
} else {
  console.log("✗ Prisma no disponible");
  errors.push("Prisma no esta disponible. Ejecute pnpm install.");
}

if (warnings.length > 0) {
  console.log("");
  console.log("Advertencias:");
  warnings.forEach((warning) => console.log(`- ${warning}`));
}

if (errors.length > 0) {
  console.log("");
  console.log("Errores encontrados:");
  errors.forEach((error) => console.log(`- ${error}`));
  process.exit(1);
}

console.log("");
console.log("✓ Todo listo");

function firstLine(output) {
  return output.split(/\r?\n/).find(Boolean) ?? "OK";
}
