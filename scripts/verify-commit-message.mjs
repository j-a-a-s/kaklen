#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const allowedTypes = ["feat", "fix", "test", "docs", "ci", "refactor", "perf", "build", "chore"];
const conventionalCommitPattern = new RegExp(
  `^(?:${allowedTypes.join("|")})\\([a-z0-9][a-z0-9._/-]*\\): \\S(?:.*\\S)?$`
);

export function isConventionalCommitMessage(message) {
  return conventionalCommitPattern.test(message.trim());
}

export function verifyCommitMessage(message) {
  const subject = message.trim();
  if (!isConventionalCommitMessage(subject)) {
    throw new Error(
      `Invalid commit message: ${subject || "<empty>"}. Expected type(scope): description.`
    );
  }
  return subject;
}

function currentCommitSubject() {
  return execFileSync("git", ["log", "-1", "--pretty=%s"], { encoding: "utf8" }).trim();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const subject = verifyCommitMessage(currentCommitSubject());
    console.log(`CONVENTIONAL COMMIT PASSED: ${subject}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Commit message validation failed.");
    process.exitCode = 1;
  }
}
