#!/usr/bin/env node
import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiDist = resolve(repoRoot, "apps/api/dist");

if (existsSync(apiDist)) {
  rmSync(apiDist, { recursive: true, force: true });
  console.log("✓ apps/api/dist");
} else {
  console.log("apps/api/dist no existe.");
}
