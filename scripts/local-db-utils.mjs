import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";
import pg from "pg";

const execFileAsync = promisify(execFile);
const DEFAULT_DATABASE_URL = "postgresql://kaklen:kaklen@localhost:5432/kaklen?schema=public";

export function loadLocalEnv() {
  const fileEnv = existsSync(".env") ? parseEnvFile(readFileSync(".env", "utf8")) : {};
  return { ...fileEnv, ...process.env };
}

export function parseEnvFile(content) {
  const env = {};
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      return;
    }
    const [key, ...rest] = trimmed.split("=");
    const rawValue = rest.join("=").trim();
    env[key.trim()] = rawValue.replace(/^['"]|['"]$/g, "");
  });
  return env;
}

export function readDatabaseUrl(env = loadLocalEnv()) {
  return env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

export function parseDatabaseUrl(databaseUrl) {
  try {
    const url = new URL(databaseUrl);
    return {
      href: url.href,
      protocol: url.protocol,
      host: url.hostname,
      port: Number(url.port || 5432),
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ""),
      search: url.search
    };
  } catch {
    return null;
  }
}

export async function checkDatabase(databaseUrl, options = {}) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    return { ok: false, type: "invalid-url", message: "DATABASE_URL no es una URL PostgreSQL valida." };
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: options.timeoutMs ?? 2500,
    statement_timeout: options.statementTimeoutMs ?? 2500
  });

  try {
    await client.connect();
    await client.query("SELECT 1");
    return { ok: true, type: "ok", parsed };
  } catch (error) {
    return classifyPostgresError(error, parsed);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function classifyPostgresError(error, parsed) {
  const code = typeof error?.code === "string" ? error.code : "";
  const message = typeof error?.message === "string" ? error.message : "";

  if (code === "28P01") {
    return { ok: false, type: "auth", parsed, message: "Credenciales invalidas." };
  }
  if (code === "3D000") {
    return { ok: false, type: "missing-db", parsed, message: `Base ${parsed.database} no existe.` };
  }
  if (["ECONNREFUSED", "ENOTFOUND", "EHOSTUNREACH", "EPERM"].includes(code) || message.toLowerCase().includes("econnrefused")) {
    return { ok: false, type: "unavailable", parsed, message: "El servidor PostgreSQL no esta disponible." };
  }
  if (message.toLowerCase().includes("password") || message.toLowerCase().includes("authentication")) {
    return { ok: false, type: "auth", parsed, message: "Credenciales invalidas." };
  }
  if (code === "ETIMEDOUT" || message.toLowerCase().includes("timeout")) {
    return { ok: false, type: "timeout", parsed, message: "Timeout conectando a PostgreSQL." };
  }
  return { ok: false, type: "unknown", parsed, message: "No fue posible conectar a PostgreSQL." };
}

export async function run(command, args, options = {}) {
  return execFileAsync(command, args, {
    cwd: process.cwd(),
    env: { ...process.env, ...(options.env ?? {}) },
    timeout: options.timeoutMs ?? 30000,
    maxBuffer: options.maxBuffer ?? 1024 * 1024
  });
}

export async function commandOk(command, args) {
  try {
    const result = await run(command, args, { timeoutMs: 10000 });
    return { ok: true, output: `${result.stdout}${result.stderr}`.trim() };
  } catch (error) {
    return { ok: false, output: `${error?.stdout ?? ""}${error?.stderr ?? ""}`.trim() };
  }
}

export function updateEnvDatabaseUrl(nextDatabaseUrl) {
  const quoted = `DATABASE_URL="${nextDatabaseUrl}"`;
  const current = existsSync(".env") ? readFileSync(".env", "utf8") : "";
  const next = current.match(/^DATABASE_URL=/m)
    ? current.replace(/^DATABASE_URL=.*$/m, quoted)
    : `${current.replace(/\s*$/, "\n")}${quoted}\n`;
  writeFileSync(".env", next);
}

export function buildDatabaseUrlFromParts(currentUrl, parts) {
  const parsed = parseDatabaseUrl(currentUrl) ?? parseDatabaseUrl(DEFAULT_DATABASE_URL);
  const url = new URL(currentUrl || DEFAULT_DATABASE_URL);
  url.username = encodeURIComponent(parts.user ?? parsed.user);
  url.password = encodeURIComponent(parts.password ?? parsed.password);
  url.pathname = `/${parts.database ?? parsed.database}`;
  if (parts.host) {
    url.hostname = parts.host;
  }
  if (parts.port) {
    url.port = String(parts.port);
  }
  return url.toString();
}

export async function inspectPostgresContainerEnv() {
  const ids = new Set();
  const compose = await commandOk("docker", ["compose", "ps", "-q", "postgres"]);
  if (compose.ok && compose.output) {
    compose.output.split(/\s+/).filter(Boolean).forEach((id) => ids.add(id));
  }

  for (const name of ["kaklen-postgres", "kaklen-postgres-1", "kaklen_postgres_1"]) {
    const inspected = await commandOk("docker", ["inspect", name, "--format", "{{.Id}}"]);
    if (inspected.ok && inspected.output) {
      ids.add(name);
    }
  }

  for (const id of ids) {
    const envResult = await commandOk("docker", ["inspect", id, "--format", "{{range .Config.Env}}{{println .}}{{end}}"]);
    if (!envResult.ok) {
      continue;
    }
    const env = parseEnvLines(envResult.output);
    if (env.POSTGRES_USER && env.POSTGRES_DB) {
      return {
        user: env.POSTGRES_USER,
        password: env.POSTGRES_PASSWORD ?? "",
        database: env.POSTGRES_DB
      };
    }
  }
  return null;
}

export async function createDatabaseIfMissing(databaseUrl) {
  const parsed = parseDatabaseUrl(databaseUrl);
  if (!parsed) {
    return false;
  }
  const adminUrl = new URL(databaseUrl);
  adminUrl.pathname = "/postgres";
  const client = new pg.Client({ connectionString: adminUrl.toString(), connectionTimeoutMillis: 2500 });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE "${parsed.database.replace(/"/g, "\"\"")}"`);
    return true;
  } finally {
    await client.end().catch(() => undefined);
  }
}

export async function tableCount(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 2500 });
  await client.connect();
  try {
    const result = await client.query("SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema = 'public'");
    return Number(result.rows[0]?.count ?? 0);
  } finally {
    await client.end().catch(() => undefined);
  }
}

export function formatDatabaseTarget(parsed) {
  if (!parsed) {
    return "DATABASE_URL invalida";
  }
  return `${parsed.user}@${parsed.host}:${parsed.port}/${parsed.database}`;
}

export function suggestionForCheck(result) {
  if (result.type === "auth") {
    return "Revise DATABASE_URL o ejecute pnpm setup para sincronizar .env con el contenedor local.";
  }
  if (result.type === "missing-db") {
    return `Ejecute pnpm setup para crear la base ${result.parsed?.database ?? ""} cuando sea posible.`;
  }
  if (result.type === "unavailable") {
    return "Ejecute docker compose up -d postgres y vuelva a intentar.";
  }
  if (result.type === "timeout") {
    return "Verifique que el puerto PostgreSQL sea correcto y que Docker este respondiendo.";
  }
  return "Revise DATABASE_URL y el estado del contenedor PostgreSQL.";
}

function parseEnvLines(output) {
  const env = {};
  output.split(/\r?\n/).forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key) {
      env[key] = rest.join("=");
    }
  });
  return env;
}
