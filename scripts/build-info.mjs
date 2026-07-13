import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export function readPackageVersion() {
  const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
  return String(packageJson.version ?? "0.0.0");
}

export function shortCommitSha(value) {
  const raw = String(value ?? "").trim();
  return raw ? raw.slice(0, 7) : "local";
}

export function resolveCommitSha() {
  if (process.env.COMMIT_SHA) {
    return shortCommitSha(process.env.COMMIT_SHA);
  }
  try {
    return shortCommitSha(execFileSync("git", ["rev-parse", "--short=7", "HEAD"], { encoding: "utf8" }));
  } catch {
    return "local";
  }
}

export function createBuildInfo() {
  return {
    version: process.env.APP_VERSION ?? readPackageVersion(),
    commitSha: resolveCommitSha(),
    buildTime: process.env.BUILD_TIME ?? new Date().toISOString(),
    environment: process.env.PUBLIC_APP_ENVIRONMENT ?? process.env.NODE_ENV ?? "development"
  };
}
