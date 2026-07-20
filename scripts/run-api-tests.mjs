#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolveApiTestMode } from "./api-test-contract.mjs";

const args = ["--passWithNoTests"];
let selection;
try {
  selection = resolveApiTestMode(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : "Invalid API test mode.");
  process.exit(1);
}
if (process.env.API_TEST_WITH_COVERAGE === "true") {
  args.push("--coverage", "--coverageReporters=json-summary", "--coverageReporters=text-summary");
}
if (selection.testRegex) args.push("--testRegex", selection.testRegex);
args.push(...selection.passthrough);

const child = spawn("jest", args, { stdio: "inherit", shell: false, env: process.env });
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
