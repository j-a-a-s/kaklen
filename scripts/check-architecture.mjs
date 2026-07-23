#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, relative, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const sourceRoots = [
  "apps/api/src",
  "apps/marketing",
  "apps/web/src",
  "packages/config/src",
  "packages/shared/src",
  "scripts"
];
const workspaceImports = new Map([
  ["@kaklen/config", "packages/config/src/index.ts"],
  ["@kaklen/shared", "packages/shared/src/index.ts"]
]);
const files = gitFiles().filter((file) => {
  if (!/\.(ts|mjs)$/.test(file)) return false;
  if (file.endsWith(".d.ts")) return false;
  return sourceRoots.some((root) => file.startsWith(`${root}/`));
});
const fileSet = new Set(files.map((file) => resolve(file)));
const graph = new Map(files.map((file) => [resolve(file), []]));

for (const file of files) {
  const absoluteFile = resolve(file);
  const imports = readImports(file);
  for (const specifier of imports) {
    const resolved = resolveImport(file, specifier);
    if (resolved && fileSet.has(resolved)) {
      graph.get(absoluteFile).push(resolved);
    }
  }
}

const cycles = findCycles(graph);
if (cycles.length > 0) {
  console.error("ARCHITECTURE CHECK FAILED");
  for (const cycle of cycles) {
    console.error(`- ${cycle.map((file) => relative(process.cwd(), file)).join(" -> ")}`);
  }
  process.exit(1);
}

console.log(`✓ Arquitectura sin ciclos detectados en ${files.length} archivos fuente`);

function gitFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" })
    .trim()
    .split("\n")
    .filter((file) => file && existsSync(file));
}

function readImports(file) {
  const source = readFileSync(file, "utf8");
  const imports = [];
  const patterns = [
    /\bimport\s+(?:[^'"]+\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+[^'"]+\s+from\s+["']([^"']+)["']/g,
    /\bimport\(["']([^"']+)["']\)/g,
    /\brequire\(["']([^"']+)["']\)/g
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.push(match[1]);
    }
  }
  return imports;
}

function resolveImport(fromFile, specifier) {
  if (workspaceImports.has(specifier)) {
    return resolve(workspaceImports.get(specifier));
  }
  let base;
  if (specifier.startsWith("@/") && fromFile.startsWith("apps/marketing/")) {
    base = resolve("apps/marketing", specifier.slice(2));
  } else if (specifier.startsWith(".")) {
    base = resolve(dirname(fromFile), specifier);
  } else {
    return null;
  }
  const candidates = [];
  if (extname(base)) {
    candidates.push(base);
  } else {
    candidates.push(
      `${base}.ts`,
      `${base}.tsx`,
      `${base}.mjs`,
      `${base}.js`,
      resolve(base, "index.ts"),
      resolve(base, "index.tsx"),
      resolve(base, "index.mjs"),
      resolve(base, "index.js")
    );
  }
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function findCycles(inputGraph) {
  const visiting = new Set();
  const visited = new Set();
  const stack = [];
  const cycles = [];
  const seen = new Set();

  for (const node of inputGraph.keys()) {
    visit(node);
  }

  return cycles;

  function visit(node) {
    if (visited.has(node)) return;
    if (visiting.has(node)) {
      const cycle = stack.slice(stack.indexOf(node)).concat(node);
      const key = cycle.map((file) => relative(process.cwd(), file)).sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        cycles.push(cycle);
      }
      return;
    }

    visiting.add(node);
    stack.push(node);
    for (const dependency of inputGraph.get(node) ?? []) {
      visit(dependency);
    }
    stack.pop();
    visiting.delete(node);
    visited.add(node);
  }
}
