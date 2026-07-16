#!/usr/bin/env node
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "@playwright/test";

const candidates = [
  process.env.CHROME_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  chromium.executablePath()
].filter((candidate) => typeof candidate === "string" && candidate.length > 0);
const chromeBinary = candidates.find((candidate) => existsSync(candidate));

if (!chromeBinary) {
  console.error("No Chrome or Chromium executable was found for Angular unit tests.");
  process.exit(1);
}

const child = spawn(
  "pnpm",
  ["exec", "ng", "test", "--watch=false", "--browsers=ChromeHeadless", "--no-progress"],
  {
    stdio: "inherit",
    env: { ...process.env, CHROME_BIN: chromeBinary }
  }
);

child.once("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
child.once("exit", (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1);
});
