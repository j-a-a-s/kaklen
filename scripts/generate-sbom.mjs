#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const outputPath = resolve(process.argv[2] ?? "artifacts/sbom.cdx.json");
const packages = gitFiles().filter((file) => file.endsWith("package.json")).map(readPackage);
const components = [];

for (const workspacePackage of packages) {
  for (const [scope, dependencies] of [
    ["runtime", workspacePackage.dependencies],
    ["development", workspacePackage.devDependencies]
  ]) {
    for (const [name, version] of Object.entries(dependencies ?? {})) {
      components.push({
        type: "library",
        name,
        version,
        scope,
        source: workspacePackage.path
      });
    }
  }
}

const sbom = {
  bomFormat: "CycloneDX",
  specVersion: "1.5",
  serialNumber: `urn:uuid:${cryptoRandomUuid()}`,
  version: 1,
  metadata: {
    component: {
      type: "application",
      name: "kaklen",
      version: readPackage("package.json").version
    }
  },
  components: dedupeComponents(components)
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(sbom, null, 2)}\n`);
console.log(`✓ SBOM generado en ${outputPath}`);

function gitFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
}

function readPackage(path) {
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  return { path, ...manifest };
}

function dedupeComponents(componentsInput) {
  const byKey = new Map();
  for (const component of componentsInput) {
    const key = `${component.name}@${component.version}:${component.scope}`;
    if (!byKey.has(key)) {
      byKey.set(key, component);
    }
  }
  return [...byKey.values()].sort((a, b) => `${a.name}${a.scope}`.localeCompare(`${b.name}${b.scope}`));
}

function cryptoRandomUuid() {
  return globalThis.crypto?.randomUUID?.() ?? "00000000-0000-4000-8000-000000000000";
}
