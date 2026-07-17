#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export function verifyAccessibilityResult(path = "artifacts/e2e-result.json") {
  const result = JSON.parse(readFileSync(path, "utf8"));
  if (result.status !== "passed") {
    throw new Error(`La suite E2E no terminó correctamente: ${result.status ?? "unknown"}.`);
  }
  if (result.accessibilityIncluded !== true) {
    throw new Error("La evidencia E2E no incluye la suite de accesibilidad.");
  }
  return { status: "passed", fullSuite: result.fullSuite === true };
}

const isEntrypoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isEntrypoint) {
  try {
    const result = verifyAccessibilityResult();
    console.log(`✓ Accesibilidad verificada por ${result.fullSuite ? "la suite E2E completa" : "la suite dedicada"}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No fue posible verificar accesibilidad.");
    process.exitCode = 1;
  }
}
