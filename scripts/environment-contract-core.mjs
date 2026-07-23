import {
  existsSync,
  readFileSync,
  readdirSync
} from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ENVIRONMENTS = Object.freeze(["development", "test", "production", "ci"]);
const SCOPES = new Set(["runtime", "development", "test", "ci", "internal"]);
const CONSUMERS = new Set(["api", "web", "scripts", "workflow", "docker"]);
const IGNORED_DIRECTORIES = new Set([
  ".artifacts",
  ".git",
  ".terraform",
  ".turbo",
  "artifacts",
  "coverage",
  "dist",
  "node_modules",
  "out-tsc",
  "playwright-report",
  "reports",
  "test-results",
  "vendor"
]);
const CODE_EXTENSIONS = new Set([".cjs", ".js", ".mjs", ".ts"]);
const WORKFLOW_EXTENSIONS = new Set([".yaml", ".yml"]);
const SHELL_EXTENSIONS = new Set([".bash", ".sh", ".zsh"]);
const ENV_NAME = "[A-Z][A-Z0-9_]*";

export const ENVIRONMENT_MANIFEST_PATH = "docs/configuration/environment-variables.json";
export const ENVIRONMENT_DOCUMENT_PATH = "docs/configuration/ENVIRONMENT_VARIABLES.md";
export const LOCAL_EXAMPLE_PATH = ".env.example";
export const PRODUCTION_EXAMPLE_PATH = ".env.production.example";

export function readEnvironmentManifest(root = process.cwd()) {
  return JSON.parse(readFileSync(resolve(root, ENVIRONMENT_MANIFEST_PATH), "utf8"));
}

export function validateEnvironmentManifest(manifest) {
  const errors = [];
  if (!manifest || manifest.schemaVersion !== 1 || !Array.isArray(manifest.variables)) {
    return ["Environment manifest must use schemaVersion 1 and define variables."];
  }

  const names = new Set();
  let previousName = "";
  for (const [index, variable] of manifest.variables.entries()) {
    const label = variable?.name ?? `entry ${index + 1}`;
    if (!new RegExp(`^${ENV_NAME}$`).test(variable?.name ?? "")) errors.push(`${label}: invalid name.`);
    if (names.has(variable?.name)) errors.push(`${label}: duplicate variable.`);
    names.add(variable?.name);
    if (previousName && variable.name < previousName) {
      errors.push(`${label}: variables must be sorted by name.`);
    }
    previousName = variable.name;
    if (!SCOPES.has(variable?.scope)) errors.push(`${label}: invalid scope.`);
    validateStringArray(variable?.requiredIn, `${label}.requiredIn`, ENVIRONMENTS, errors);
    validateStringArray(variable?.availableIn, `${label}.availableIn`, ENVIRONMENTS, errors);
    validateStringArray(variable?.consumers, `${label}.consumers`, [...CONSUMERS], errors, true);
    if (typeof variable?.secret !== "boolean") errors.push(`${label}: secret must be boolean.`);
    if (variable?.default !== null && !["string", "number", "boolean"].includes(typeof variable?.default)) {
      errors.push(`${label}: default must be scalar or null.`);
    }
    if (typeof variable?.localExample !== "boolean") errors.push(`${label}: localExample must be boolean.`);
    if (typeof variable?.productionExample !== "boolean") errors.push(`${label}: productionExample must be boolean.`);
    if (typeof variable?.description !== "string" || variable.description.trim().length === 0) {
      errors.push(`${label}: description is required.`);
    }
    for (const environment of variable?.requiredIn ?? []) {
      if (!(variable?.availableIn ?? []).includes(environment)) {
        errors.push(`${label}: required environment ${environment} is not available.`);
      }
    }
    if ((variable?.requiredIn ?? []).includes("production") && variable?.productionExample !== true) {
      errors.push(`${label}: required production variables must be in the production example.`);
    }
    if (variable?.scope === "internal" && variable?.consumers?.length === 0 && !variable?.justification) {
      errors.push(`${label}: unused internal variables require justification.`);
    }
  }

  if (!Array.isArray(manifest.dynamicAccess)) {
    errors.push("Environment manifest must define dynamicAccess.");
  } else {
    const paths = new Set();
    for (const access of manifest.dynamicAccess) {
      if (typeof access?.path !== "string" || paths.has(access.path)) {
        errors.push(`${access?.path ?? "dynamic access"}: invalid or duplicate path.`);
      }
      paths.add(access?.path);
      validateStringArray(access?.variables, `${access?.path}.variables`, [...names], errors, true);
      if (typeof access?.description !== "string" || access.description.trim().length === 0) {
        errors.push(`${access?.path ?? "dynamic access"}: description is required.`);
      }
    }
  }
  return errors;
}

export function discoverEnvironmentVariables(root = process.cwd()) {
  const variables = new Map();
  const dynamicPaths = new Set();
  for (const absolutePath of walkFiles(root)) {
    const path = normalizePath(relative(root, absolutePath));
    if (isGeneratedEnvironmentFile(path)) continue;
    const content = readFileSync(absolutePath, "utf8");
    const consumer = consumerForPath(path);
    const extension = extname(path);
    const baseName = path.slice(path.lastIndexOf("/") + 1);

    if (CODE_EXTENSIONS.has(extension)) {
      collect(content, /process\.env\.([A-Z][A-Z0-9_]*)/g, path, consumer, variables);
      collect(content, /process\.env\s*\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g, path, consumer, variables);
      collect(content, /\benv\.([A-Z][A-Z0-9_]*)/g, path, consumer, variables);
      collect(content, /\benv\s*\[\s*["']([A-Z][A-Z0-9_]*)["']\s*\]/g, path, consumer, variables);
      collect(content, /requireString\(\s*env\s*,\s*["']([A-Z][A-Z0-9_]*)["']/g, path, consumer, variables);
      if (/(?:process\.env|\benv)\s*\[\s*(?!["'])/.test(content)) dynamicPaths.add(path);
    }

    if (baseName === "package.json") {
      const parsed = JSON.parse(content);
      for (const command of Object.values(parsed.scripts ?? {})) {
        collectShellVariables(String(command), path, "scripts", variables);
      }
    } else if (baseName === "docker-compose.yml" || baseName === "docker-compose.yaml") {
      collect(content, new RegExp(`^\\s*(${ENV_NAME})\\s*:`, "gm"), path, "docker", variables);
      collectShellVariables(content, path, "docker", variables);
    } else if (WORKFLOW_EXTENSIONS.has(extension)) {
      collect(content, new RegExp(`^\\s*(${ENV_NAME})\\s*:`, "gm"), path, "workflow", variables);
      collectShellVariables(content, path, "workflow", variables);
    } else if (baseName.startsWith("Dockerfile")) {
      collect(content, new RegExp(`^\\s*(?:ARG|ENV)\\s+(${ENV_NAME})(?:=|\\s)`, "gm"), path, "docker", variables);
      collectShellVariables(content, path, "docker", variables);
    } else if (SHELL_EXTENSIONS.has(extension)) {
      collectShellVariables(content, path, "scripts", variables);
    }
  }
  return { variables, dynamicPaths };
}

export function renderEnvironmentExample(manifest, target) {
  const production = target === "production";
  const selected = manifest.variables.filter((variable) =>
    production ? variable.productionExample : variable.localExample
  );
  const lines = [
    "# Generated from docs/configuration/environment-variables.json.",
    production
      ? "# Production contract: fill every required value in the deployment secret/config store."
      : "# Local development only. Known local secrets below must never be reused in production.",
    ""
  ];

  const groups = production
    ? [
        ["Required in production", selected.filter((item) => item.requiredIn.includes("production"))],
        ["Optional in production", selected.filter((item) => !item.requiredIn.includes("production"))]
      ]
    : [["Local bootstrap", selected]];

  for (const [title, variables] of groups) {
    if (variables.length === 0) continue;
    lines.push(`# ${title}`);
    for (const variable of variables) {
      const value = production
        ? variable.secret
          ? ""
          : variable.productionValue ?? variable.default ?? ""
        : variable.localValue ?? variable.default ?? "";
      const secretNote = variable.secret
        ? production
          ? " Secret: inject securely; intentionally empty."
          : " Local development secret only."
        : "";
      lines.push(`# ${variable.description}${secretNote}`);
      lines.push(`${variable.name}=${formatEnvironmentValue(value)}`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function renderEnvironmentMarkdown(manifest) {
  const sections = [
    ["Runtime productivo", (item) => item.scope === "runtime"],
    ["Desarrollo local", (item) => item.scope === "development"],
    ["Testing", (item) => item.scope === "test"],
    ["CI e internas", (item) => item.scope === "ci" || item.scope === "internal"]
  ];
  const lines = [
    "# Variables de entorno",
    "",
    "Este documento se genera desde `environment-variables.json` mediante `pnpm env:update`.",
    "El manifiesto es la única fuente de clasificación, obligatoriedad y consumidores.",
    ""
  ];
  for (const [title, predicate] of sections) {
    const variables = manifest.variables.filter(predicate);
    lines.push(`## ${title}`, "");
    lines.push("| Variable | Alcance | Ambientes | Obligatoria | Tipo | Default | Consumidores | Descripción |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- | --- |");
    for (const variable of variables) {
      lines.push(
        `| \`${variable.name}\` | ${variable.scope} | ${variable.availableIn.join(", ")} | ${variable.requiredIn.length > 0 ? variable.requiredIn.join(", ") : "no"} | ${variable.secret ? "secret" : "non-secret"} | ${formatMarkdownDefault(variable.default)} | ${variable.consumers.join(", ")} | ${escapeTable(variable.description)} |`
      );
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

export function auditEnvironmentContract(root = process.cwd()) {
  const manifest = readEnvironmentManifest(root);
  const errors = validateEnvironmentManifest(manifest);
  if (errors.length > 0) return { errors, manifest, discovered: null };

  const discovered = discoverEnvironmentVariables(root);
  const entries = new Map(manifest.variables.map((variable) => [variable.name, variable]));
  const dynamicByPath = new Map(manifest.dynamicAccess.map((access) => [access.path, access]));
  for (const path of discovered.dynamicPaths) {
    if (!dynamicByPath.has(path)) errors.push(`${path}: dynamic environment access is not declared.`);
  }
  for (const path of dynamicByPath.keys()) {
    if (!discovered.dynamicPaths.has(path)) errors.push(`${path}: obsolete dynamic environment declaration.`);
  }

  const dynamicallyConsumed = new Set(manifest.dynamicAccess.flatMap((access) => access.variables));
  for (const [name, usage] of discovered.variables) {
    const entry = entries.get(name);
    if (!entry) {
      errors.push(`${name}: used by ${[...usage.paths].join(", ")} but missing from the manifest.`);
      continue;
    }
    for (const consumer of usage.consumers) {
      if (!entry.consumers.includes(consumer)) errors.push(`${name}: missing declared consumer ${consumer}.`);
    }
  }
  for (const variable of manifest.variables) {
    if (!discovered.variables.has(variable.name) && !dynamicallyConsumed.has(variable.name)) {
      if (!(variable.scope === "internal" && variable.justification)) {
        errors.push(`${variable.name}: manifest entry has no discovered consumer.`);
      }
    }
  }

  verifyExample(root, manifest, "local", errors);
  verifyExample(root, manifest, "production", errors);
  compareGeneratedFile(
    root,
    ENVIRONMENT_DOCUMENT_PATH,
    renderEnvironmentMarkdown(manifest),
    "Generated environment documentation differs from the manifest.",
    errors
  );
  return { errors, manifest, discovered };
}

export function parseEnvironmentExample(content, path = "environment example") {
  const values = new Map();
  const errors = [];
  for (const [index, rawLine] of content.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
    if (!match) {
      errors.push(`${path}:${index + 1}: invalid assignment.`);
      continue;
    }
    if (values.has(match[1])) errors.push(`${path}:${index + 1}: duplicate ${match[1]}.`);
    values.set(match[1], unquote(match[2]));
  }
  return { values, errors };
}

function verifyExample(root, manifest, target, errors) {
  const production = target === "production";
  const path = production ? PRODUCTION_EXAMPLE_PATH : LOCAL_EXAMPLE_PATH;
  const expected = renderEnvironmentExample(manifest, target);
  compareGeneratedFile(root, path, expected, `${path} differs from the manifest.`, errors);
  if (!existsSync(resolve(root, path))) return;
  const parsed = parseEnvironmentExample(readFileSync(resolve(root, path), "utf8"), path);
  errors.push(...parsed.errors);
  const flag = production ? "productionExample" : "localExample";
  const expectedNames = new Set(manifest.variables.filter((item) => item[flag]).map((item) => item.name));
  for (const name of parsed.values.keys()) {
    const entry = manifest.variables.find((item) => item.name === name);
    if (!entry) errors.push(`${path}: ${name} is not documented.`);
    else if (!entry[flag]) errors.push(`${path}: ${name} is not marked ${flag}.`);
  }
  for (const name of expectedNames) {
    if (!parsed.values.has(name)) errors.push(`${path}: missing ${name}.`);
  }
  if (!production) return;
  for (const variable of manifest.variables.filter((item) => item.requiredIn.includes("production"))) {
    if (!parsed.values.has(variable.name)) errors.push(`${path}: required ${variable.name} is missing.`);
  }
  for (const variable of manifest.variables.filter((item) => item.secret && item.productionExample)) {
    if ((parsed.values.get(variable.name) ?? "") !== "") {
      errors.push(`${path}: production secret ${variable.name} must be empty.`);
    }
  }
  const fixedValues = new Map([
    ["NODE_ENV", "production"],
    ["DATABASE_SSL", "true"],
    ["COOKIE_SECURE", "true"],
    ["SWAGGER_ENABLED", "false"]
  ]);
  for (const [name, value] of fixedValues) {
    if (parsed.values.get(name) !== value) errors.push(`${path}: ${name} must be ${value}.`);
  }
  for (const name of ["APP_PUBLIC_URL", "APP_WEB_URL", "CORS_ALLOWED_ORIGINS", "AUTH_ALLOWED_ORIGINS"]) {
    if (!(parsed.values.get(name) ?? "").startsWith("https://")) {
      errors.push(`${path}: ${name} must use HTTPS.`);
    }
  }
}

function compareGeneratedFile(root, path, expected, message, errors) {
  const absolute = resolve(root, path);
  if (!existsSync(absolute)) {
    errors.push(`${path} is missing.`);
    return;
  }
  if (readFileSync(absolute, "utf8") !== expected) errors.push(message);
}

function collectShellVariables(content, path, consumer, variables) {
  collect(content, new RegExp(`\\$\\{(${ENV_NAME})(?::[-?+]?[^}]*)?\\}`, "g"), path, consumer, variables);
  collect(content, new RegExp(`\\$(${ENV_NAME})\\b`, "g"), path, consumer, variables);
  collect(content, new RegExp(`(?:^|[\\s;&|])(${ENV_NAME})=`, "g"), path, consumer, variables);
}

function collect(content, pattern, path, consumer, variables) {
  for (const match of content.matchAll(pattern)) {
    const name = match[1];
    if (!variables.has(name)) variables.set(name, { consumers: new Set(), paths: new Set() });
    variables.get(name).consumers.add(consumer);
    variables.get(name).paths.add(path);
  }
}

function consumerForPath(path) {
  if (path.startsWith("apps/api/") || path.startsWith("packages/config/")) return "api";
  if (path.startsWith("apps/web/") || path.startsWith("apps/marketing/")) return "web";
  if (path.startsWith(".github/")) return "workflow";
  if (path.includes("Dockerfile") || path.startsWith("docker-compose.")) return "docker";
  return "scripts";
}

function walkFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.isFile()) files.push(path);
    }
  };
  visit(root);
  return files;
}

function isGeneratedEnvironmentFile(path) {
  return path === ENVIRONMENT_MANIFEST_PATH || path === ENVIRONMENT_DOCUMENT_PATH || path === LOCAL_EXAMPLE_PATH || path === PRODUCTION_EXAMPLE_PATH;
}

function validateStringArray(value, label, allowed, errors, requireValue = false) {
  if (!Array.isArray(value) || (requireValue && value.length === 0)) {
    errors.push(`${label} must be ${requireValue ? "a non-empty " : "an "}array.`);
    return;
  }
  if (new Set(value).size !== value.length) errors.push(`${label} contains duplicates.`);
  for (const item of value) {
    if (!allowed.includes(item)) errors.push(`${label} contains unsupported value ${item}.`);
  }
}

function formatEnvironmentValue(value) {
  const text = String(value);
  if (!text) return "";
  return /\s|#|["']/.test(text) ? JSON.stringify(text) : text;
}

function formatMarkdownDefault(value) {
  if (value === null) return "none";
  return `\`${String(value).replaceAll("|", "\\|")}\``;
}

function escapeTable(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function unquote(value) {
  const trimmed = value.trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function normalizePath(path) {
  return path.split("\\").join("/");
}
