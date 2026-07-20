import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  extractPnpmCommands,
  markdownAnchors,
  verifyDocumentationContract
} from "./documentation-contract-core.mjs";

test("repository documentation contract validates every Markdown file", () => {
  const result = verifyDocumentationContract();
  assert.deepEqual(result.errors, []);
  assert.ok(result.fileCount > 50);
});

test("Markdown anchors follow GitHub duplicate-heading behavior", () => {
  assert.deepEqual(
    [...markdownAnchors("# Title\n## Repeated value\n## Repeated value\n<a id=\"manual\"></a>\n")],
    ["title", "repeated-value", "repeated-value-1", "manual"]
  );
});

test("pnpm command extraction ignores options and captures scripts", () => {
  assert.deepEqual(
    extractPnpmCommands("```bash\npnpm install\npnpm run setup\npnpm --filter @kaklen/api test\npnpm check\n```\n"),
    ["install", "setup", "check"]
  );
});

test("documentation audit rejects missing anchors, absolute internal links, and unknown commands", () => {
  const root = createFixture();
  let result = verifyDocumentationContract(root);
  assert.deepEqual(result.errors, []);

  append(root, "README.md", "\n[Missing](docs/reference.md#absent)\n[Absolute](/docs/reference.md)\n`pnpm missing:command`\n");
  result = verifyDocumentationContract(root);
  assert.match(result.errors.join("\n"), /missing anchor #absent/);
  assert.match(result.errors.join("\n"), /internal link must be relative/);
  assert.match(result.errors.join("\n"), /documented pnpm command does not exist/);
});

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "kaklen-docs-"));
  write(root, "package.json", JSON.stringify({ scripts: { start: "x", check: "x", "quality:gate": "x", "release:check:strict": "x", setup: "x" } }));
  write(root, "INSTALL.md", "# Install\n\n`pnpm install`\n");
  write(root, "CONTRIBUTING.md", "# Contributing\n");
  write(root, "docs/reference.md", "# Reference\n\n## Existing anchor\n");
  write(root, "docs/START_HERE.md", [
    "# Start Here",
    "Desarrollar → pnpm start",
    "Validar rápido → pnpm check",
    "Validar integración → pnpm quality:gate",
    "Preparar release → pnpm release:check:strict"
  ].join("\n"));
  write(root, "docs/development/COMMANDS.md", publicCommands("# Commands\n\n## Interfaz pública"));
  write(root, "README.md", `${publicCommands("# Fixture\n\n## Cuatro comandos")}\n\n[Reference](docs/reference.md#existing-anchor)\n`);
  return root;
}

function publicCommands(prefix) {
  return `${prefix}\n\n| Command |\n| --- |\n| \`pnpm start\` |\n| \`pnpm check\` |\n| \`pnpm quality:gate\` |\n| \`pnpm release:check:strict\` |`;
}

function write(root, path, content) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}

function append(root, path, content) {
  const absolute = join(root, path);
  writeFileSync(absolute, `${readFileSync(absolute, "utf8")}${content}`);
}
