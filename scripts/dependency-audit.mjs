#!/usr/bin/env node
import { readFileSync } from "node:fs";

const endpoint = "https://registry.npmjs.org/-/npm/v1/security/advisories/bulk";
const packages = readPnpmLockPackages("pnpm-lock.yaml");

if (Object.keys(packages).length === 0) {
  console.error("No se encontraron paquetes auditables en pnpm-lock.yaml");
  process.exit(1);
}

const response = await fetch(endpoint, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(packages)
});

if (!response.ok) {
  console.error(`Dependency audit no pudo consultar npm advisory bulk endpoint: HTTP ${response.status}`);
  process.exit(1);
}

const advisories = await response.json();
const findings = [];
for (const [name, entries] of Object.entries(advisories)) {
  for (const advisory of entries) {
    if (["high", "critical"].includes(advisory.severity)) {
      findings.push({
        name,
        severity: advisory.severity,
        title: advisory.title,
        url: advisory.url
      });
    }
  }
}

if (findings.length > 0) {
  console.error("DEPENDENCY AUDIT FAILED");
  for (const finding of findings) {
    console.error(`- ${finding.severity}: ${finding.name} - ${finding.title} (${finding.url})`);
  }
  process.exit(1);
}

console.log(`✓ Dependency audit sin vulnerabilidades high/critical en ${Object.keys(packages).length} paquetes`);

function readPnpmLockPackages(path) {
  const lockfile = readFileSync(path, "utf8");
  const lines = lockfile.split(/\r?\n/);
  const result = new Map();
  let inPackages = false;

  for (const line of lines) {
    if (line === "packages:") {
      inPackages = true;
      continue;
    }
    if (!inPackages) {
      continue;
    }
    const match = line.match(/^  '?([^':]+(?:\/[^'@:]+)?@[^':]+)'?:$/);
    if (!match) {
      continue;
    }
    const parsed = parsePackageKey(match[1]);
    if (!parsed || parsed.version.startsWith("link:") || parsed.version.startsWith("workspace:")) {
      continue;
    }
    const versions = result.get(parsed.name) ?? new Set();
    versions.add(parsed.version);
    result.set(parsed.name, versions);
  }

  return Object.fromEntries([...result.entries()].map(([name, versions]) => [name, [...versions].sort()]));
}

function parsePackageKey(key) {
  const cleanKey = key.replace(/^'|'$/g, "");
  const atIndex = cleanKey.lastIndexOf("@");
  if (atIndex <= 0) {
    return null;
  }
  const name = cleanKey.slice(0, atIndex);
  const version = cleanKey.slice(atIndex + 1).split("(")[0];
  if (!name || !version) {
    return null;
  }
  return { name, version };
}
