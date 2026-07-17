#!/usr/bin/env node
import { spawn } from "node:child_process";
import { verifyAccessibilityResult } from "./verify-accessibility-result.mjs";

if (process.env.ACCESSIBILITY_REUSE_E2E === "true") {
  try {
    verifyAccessibilityResult();
    console.log("✓ Accesibilidad reutiliza la evidencia E2E completa");
  } catch (error) {
    console.error(error instanceof Error ? error.message : "No fue posible reutilizar la evidencia E2E.");
    process.exitCode = 1;
  }
} else {
  const child = spawn(process.execPath, ["scripts/run-e2e.mjs", "e2e/accessibility.spec.mjs"], {
    stdio: "inherit",
    shell: false,
    env: process.env
  });
  child.once("error", (error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }
    process.exitCode = code ?? 1;
  });
}
