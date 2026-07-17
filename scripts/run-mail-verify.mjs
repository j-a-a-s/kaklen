#!/usr/bin/env node
import { spawn } from "node:child_process";

const commands = process.env.MAIL_REUSE_CONFIG_BUILD === "true"
  ? [["pnpm", ["--filter", "@kaklen/api", "exec", "ts-node", "--transpile-only", "scripts/mail-verify.ts"]]]
  : [
      ["pnpm", ["--filter", "@kaklen/config", "build"]],
      ["pnpm", ["--filter", "@kaklen/api", "exec", "ts-node", "--transpile-only", "scripts/mail-verify.ts"]]
    ];

for (const [command, args] of commands) {
  const result = await run(command, args);
  if (result.signal) {
    process.kill(process.pid, result.signal);
    break;
  }
  if (result.code !== 0) {
    process.exitCode = result.code ?? 1;
    break;
  }
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    child.once("error", () => resolveRun({ code: 1, signal: null }));
    child.once("exit", (code, signal) => resolveRun({ code, signal }));
  });
}
