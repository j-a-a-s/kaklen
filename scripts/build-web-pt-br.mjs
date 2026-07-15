#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const webDir = resolve(rootDir, "apps/web");
const sourcePath = resolve(webDir, "src/locale/messages.pt-BR.xlf");
const generatedDir = resolve(webDir, ".angular/i18n");
const generatedPath = resolve(generatedDir, "messages.pt.xlf");

const source = readFileSync(sourcePath, "utf8");
const generated = source.replace('target-language="pt-BR"', 'target-language="pt"');

writeRuntimeConfig();
mkdirSync(generatedDir, { recursive: true });
writeFileSync(generatedPath, generated);

const child = spawn("pnpm", ["exec", "ng", "build", "--configuration", "pt-BR"], {
  cwd: webDir,
  env: { ...process.env, NG_CLI_ANALYTICS: "false" },
  stdio: "inherit"
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
