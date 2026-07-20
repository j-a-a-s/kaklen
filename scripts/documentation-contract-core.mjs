import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";

const ROOT_DOCUMENTS = ["README.md", "INSTALL.md", "CONTRIBUTING.md"];
const PUBLIC_COMMANDS = Object.freeze([
  "pnpm start",
  "pnpm check",
  "pnpm quality:gate",
  "pnpm release:check:strict"
]);
const PNPM_BUILT_INS = new Set([
  "add",
  "approve-builds",
  "audit",
  "dlx",
  "exec",
  "fetch",
  "install",
  "list",
  "outdated",
  "remove",
  "update",
  "why"
]);

export function documentationFiles(root = process.cwd()) {
  const files = ROOT_DOCUMENTS.filter((path) => existsSync(resolve(root, path)));
  const docsRoot = resolve(root, "docs");
  if (existsSync(docsRoot)) {
    for (const path of walkMarkdown(docsRoot)) files.push(normalizePath(relative(root, path)));
  }
  return [...new Set(files)].sort();
}

export function verifyDocumentationContract(root = process.cwd()) {
  const errors = [];
  const paths = documentationFiles(root);
  const documents = new Map();
  for (const path of paths) {
    try {
      const buffer = readFileSync(resolve(root, path));
      const content = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
      documents.set(path, content);
    } catch (error) {
      errors.push(`${path}: not valid UTF-8 (${error instanceof Error ? error.message : "decode failure"}).`);
    }
  }

  for (const required of ROOT_DOCUMENTS) {
    if (!documents.has(required)) errors.push(`${required}: required document is missing.`);
  }
  const readme = documents.get("README.md");
  if (readme && readme.split(/\r?\n/).length > 100) errors.push("README.md: must contain at most 100 lines.");

  const packageJson = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
  const scripts = new Set(Object.keys(packageJson.scripts ?? {}));
  for (const [path, content] of documents) {
    validateLinks({ root, path, content, documents, errors });
    validateCommands({ path, content, scripts, errors });
  }
  validatePublicCommandContract(documents, errors);
  for (const [path, content] of documents) {
    if (/\b(?:cinco|5) comandos públicos\b/i.test(content)) {
      errors.push(`${path}: contradicts the four-command public interface.`);
    }
    if (/\bpnpm\s+(?:env:verify|env:update|docs:verify)\b[^\n]*(?:comando público|public command)/i.test(content)) {
      errors.push(`${path}: internal contract commands must not be public commands.`);
    }
  }
  return { errors, fileCount: documents.size, commandCount: scripts.size };
}

export function markdownAnchors(content) {
  const anchors = new Set();
  const occurrences = new Map();
  for (const line of content.split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      const base = githubSlug(heading[1]);
      const count = occurrences.get(base) ?? 0;
      anchors.add(count === 0 ? base : `${base}-${count}`);
      occurrences.set(base, count + 1);
    }
    for (const explicit of line.matchAll(/<(?:a\s+[^>]*(?:id|name)|[^>]+\s+id)=["']([^"']+)["'][^>]*>/gi)) {
      anchors.add(explicit[1]);
    }
  }
  return anchors;
}

export function extractPnpmCommands(content) {
  const commands = [];
  const surfaces = [];
  const prose = content.replace(/```[^\n]*\n([\s\S]*?)```/g, (_match, body) => {
    surfaces.push(body);
    return "";
  });
  for (const match of prose.matchAll(/`([^`\n]+)`/g)) surfaces.push(match[1]);
  for (const surface of surfaces) {
    for (const match of surface.matchAll(/\bpnpm(?:\s+run)?\s+([^\s`|;&]+)/g)) {
      const token = match[1].replace(/[),.:]+$/g, "");
      if (!token || token.startsWith("-") || token.startsWith("<")) continue;
      commands.push(token);
    }
  }
  return commands;
}

function validateLinks({ root, path, content, documents, errors }) {
  for (const match of content.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    const destination = normalizeDestination(match[1]);
    if (!destination || /^(?:https?:|mailto:|tel:|data:)/i.test(destination)) continue;
    if (/^file:/i.test(destination) || (destination.startsWith("/") && !destination.startsWith("//"))) {
      errors.push(`${path}: internal link must be relative (${destination}).`);
      continue;
    }

    const [rawTarget, rawAnchor = ""] = destination.split("#", 2);
    const target = safeDecode(rawTarget.split("?", 1)[0]);
    const anchor = safeDecode(rawAnchor);
    const resolved = target ? resolve(dirname(resolve(root, path)), target) : resolve(root, path);
    let targetPath = normalizePath(relative(root, resolved));
    if (existsSync(resolved) && statSync(resolved).isDirectory()) {
      targetPath = normalizePath(join(targetPath, "README.md"));
    }
    const absoluteTarget = resolve(root, targetPath);
    if (!existsSync(absoluteTarget)) {
      errors.push(`${path}: missing relative link target ${destination}.`);
      continue;
    }
    if (!anchor) continue;
    if (extname(absoluteTarget).toLowerCase() !== ".md") {
      errors.push(`${path}: anchor targets a non-Markdown file (${destination}).`);
      continue;
    }
    const targetContent = documents.get(targetPath) ?? readUtf8(absoluteTarget, targetPath, errors);
    if (targetContent !== null && !markdownAnchors(targetContent).has(anchor)) {
      errors.push(`${path}: missing anchor #${anchor} in ${targetPath}.`);
    }
  }
}

function validateCommands({ path, content, scripts, errors }) {
  for (const command of extractPnpmCommands(content)) {
    if (PNPM_BUILT_INS.has(command) || scripts.has(command)) continue;
    errors.push(`${path}: documented pnpm command does not exist (${command}).`);
  }
}

function validatePublicCommandContract(documents, errors) {
  const sections = [
    ["README.md", "Cuatro comandos"],
    ["docs/development/COMMANDS.md", "Interfaz pública"]
  ];
  for (const [path, heading] of sections) {
    const content = documents.get(path);
    if (!content) {
      errors.push(`${path}: required public command document is missing.`);
      continue;
    }
    const section = markdownSection(content, heading);
    const commands = [...new Set(PUBLIC_COMMANDS.filter((command) => section.includes(`\`${command}\``)))];
    if (commands.length !== PUBLIC_COMMANDS.length) {
      errors.push(`${path}: ${heading} must expose exactly the four canonical commands.`);
    }
  }

  const startHere = documents.get("docs/START_HERE.md");
  if (!startHere) {
    errors.push("docs/START_HERE.md: required onboarding document is missing.");
    return;
  }
  const requiredLines = [
    "Desarrollar → pnpm start",
    "Validar rápido → pnpm check",
    "Validar integración → pnpm quality:gate",
    "Preparar release → pnpm release:check:strict"
  ];
  for (const line of requiredLines) {
    if (!startHere.includes(line)) errors.push(`docs/START_HERE.md: missing canonical instruction ${line}.`);
  }
}

function markdownSection(content, heading) {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => new RegExp(`^##\\s+${escapeRegex(heading)}\\s*$`, "i").test(line));
  if (start < 0) return "";
  const end = lines.findIndex((line, index) => index > start && /^##\s+/.test(line));
  return lines.slice(start, end < 0 ? undefined : end).join("\n");
}

function normalizeDestination(raw) {
  const trimmed = raw.trim();
  if (trimmed.startsWith("<")) {
    const end = trimmed.indexOf(">");
    return end >= 0 ? trimmed.slice(1, end) : trimmed;
  }
  return trimmed.split(/\s+["'(]/, 1)[0];
}

function githubSlug(value) {
  return value
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[`*_~]/g, "")
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/\s+/g, "-");
}

function walkMarkdown(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walkMarkdown(path));
    else if (entry.isFile() && entry.name.endsWith(".md")) paths.push(path);
  }
  return paths;
}

function readUtf8(path, label, errors) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(readFileSync(path));
  } catch {
    errors.push(`${label}: not valid UTF-8.`);
    return null;
  }
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizePath(path) {
  return path.split("\\").join("/");
}
