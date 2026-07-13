#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

export const CLEAN_DEV_TARGETS = [
  ".turbo",
  "apps/web/.angular",
  "apps/web/dist",
  "apps/web/out-tsc",
  "apps/api/dist",
  "packages/config/dist",
  "packages/shared/dist",
  "coverage",
  "apps/web/public/runtime-config.js",
  "apps/web/public/runtime-config.json"
];

export const PRESERVED_TARGETS = [".env", "node_modules", "docker volume", "postgres data"];

export function cleanDev(cwd = process.cwd()) {
  const removed = [];
  for (const target of CLEAN_DEV_TARGETS) {
    const fullPath = join(cwd, target);
    if (existsSync(fullPath)) {
      rmSync(fullPath, { recursive: true, force: true });
      removed.push(target);
    }
  }
  return removed;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log("KAKLEN CLEAN DEV");
  const removed = cleanDev();
  if (removed.length === 0) {
    console.log("No habia artefactos locales para limpiar.");
  } else {
    removed.forEach((target) => console.log(`✓ ${target}`));
  }
  console.log("Preservado: .env, node_modules, PostgreSQL y volumenes Docker.");
}
