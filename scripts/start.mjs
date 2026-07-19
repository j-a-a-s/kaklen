#!/usr/bin/env node
import { spawn } from "node:child_process";
import { parseStartArguments, startHelp } from "./start-command.mjs";

const result = parseStartArguments(process.argv.slice(2));

if (result.kind === "help") {
  console.log(startHelp());
} else if (result.kind === "error") {
  console.error(result.message);
  console.error("");
  console.error(startHelp());
  process.exitCode = 1;
} else {
  const child = spawn("pnpm", ["run", result.script], {
    stdio: "inherit",
    shell: false,
    env: process.env
  });

  const forwardSignal = (signal) => {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill(signal);
    }
  };
  process.once("SIGINT", () => forwardSignal("SIGINT"));
  process.once("SIGTERM", () => forwardSignal("SIGTERM"));

  child.once("error", (error) => {
    console.error(`No fue posible iniciar ${result.script}: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("exit", (code, signal) => {
    process.exitCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : (code ?? 1);
  });
}
