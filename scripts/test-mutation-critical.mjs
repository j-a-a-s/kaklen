#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const mutants = [
  {
    name: "RBAC permission check cannot be bypassed",
    file: "apps/api/src/organizations/organization-access.guard.ts",
    find: "if (!roleHasPermissions(membership.role, requiredPermissions)) {",
    replace: "if (false && !roleHasPermissions(membership.role, requiredPermissions)) {",
    specs: ["organization-access.guard.spec.ts"]
  },
  {
    name: "Quotation percentage discounts above 100% are rejected",
    file: "packages/shared/src/quotation-money.ts",
    find: "assertBetween(discountValue, 0n, PERCENT_DENOMINATOR, `lines[${index}].discountValue`);",
    replace: "assertBetween(discountValue, 0n, PERCENT_DENOMINATOR * 10n, `lines[${index}].discountValue`);",
    workspace: "@kaklen/shared",
    specs: ["quotation-money.test.mjs"]
  },
  {
    name: "Event dates must end strictly after start",
    file: "apps/api/src/events/events.service.ts",
    find: "new Date(startAt).getTime() >= new Date(endAt).getTime()",
    replace: "new Date(startAt).getTime() > new Date(endAt).getTime()",
    specs: ["events.service.spec.ts"]
  },
  {
    name: "Client duplicate tax IDs stay blocked",
    file: "apps/api/src/clients/clients.service.ts",
    find: "if (existing) {\n      throw new ConflictException({",
    replace: "if (false && existing) {\n      throw new ConflictException({",
    specs: ["clients.service.spec.ts"]
  },
  {
    name: "JWT guard rejects malformed bearer headers",
    file: "apps/api/src/auth/jwt-auth.guard.ts",
    find: 'if (scheme !== "Bearer" || !token) {',
    replace: 'if (scheme !== "Bearer" && !token) {',
    specs: ["jwt-auth.guard.spec.ts"]
  }
];

const originals = new Map();
let failed = false;

process.once("SIGINT", () => {
  restoreAll();
  process.exit(130);
});
process.once("SIGTERM", () => {
  restoreAll();
  process.exit(143);
});

console.log("KAKLEN CRITICAL MUTATION TEST");

try {
  for (const mutant of mutants) {
    const original = readFileSync(mutant.file, "utf8");
    originals.set(mutant.file, original);

    if (!original.includes(mutant.find)) {
      console.error(`✗ Mutante no aplicable: ${mutant.name}`);
      console.error(`  Patron no encontrado en ${mutant.file}`);
      failed = true;
      continue;
    }

    writeFileSync(mutant.file, original.replace(mutant.find, mutant.replace));
    const result = await runFocusedTests(mutant.workspace ?? "@kaklen/api", mutant.specs);
    writeFileSync(mutant.file, original);

    if (result.ok) {
      console.error(`✗ Mutante sobrevivio: ${mutant.name}`);
      failed = true;
      continue;
    }

    console.log(`✓ Mutante detectado: ${mutant.name}`);
  }
} finally {
  restoreAll();
}

if (failed) {
  console.error("Mutation critical fallido");
  process.exit(1);
}

console.log("✓ Mutacion critica cubierta");

function restoreAll() {
  for (const [file, content] of originals.entries()) {
    writeFileSync(file, content);
  }
}

function runFocusedTests(workspace, specs) {
  return new Promise((resolveRun) => {
    const child = spawn("pnpm", ["--filter", workspace, "test", "--", ...specs], {
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    let output = "";
    child.stdout.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      output += chunk.toString();
    });
    child.on("exit", (code, signal) => {
      if (code === 0 && !signal && output.includes("Test Suites:")) {
        resolveRun({ ok: true });
        return;
      }
      resolveRun({ ok: false });
    });
  });
}
