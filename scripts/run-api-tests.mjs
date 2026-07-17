#!/usr/bin/env node
import { spawn } from "node:child_process";

const args = ["--passWithNoTests"];
if (process.env.API_TEST_WITH_COVERAGE === "true") {
  args.push("--coverage", "--coverageReporters=json-summary", "--coverageReporters=text-summary");
}
args.push(...process.argv.slice(2));

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
