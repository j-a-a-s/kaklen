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

export function resolveCommitRange(args = [], env = process.env) {
  const rangeIndex = args.indexOf("--range");
  if (rangeIndex >= 0) {
    const range = args[rangeIndex + 1]?.trim();
    if (!range) throw new Error("--range requires a commit range.");
    return normalizeCommitRange(range);
  }
  const environmentRange = env.COMMIT_RANGE?.trim();
  return normalizeCommitRange(environmentRange || "HEAD");
}

export function commitsForRange(range, cwd = process.cwd()) {
  const normalizedRange = normalizeCommitRange(range);
  const singleCommit = !normalizedRange.includes("..");
  const args = ["log", "--no-merges", "--format=%H%x09%s"];
  if (singleCommit) args.push("-1");
  args.push(normalizedRange);
  const output = execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
  if (!output) return [];
  return output.split("\n").map((line) => {
    const separator = line.indexOf("\t");
    if (separator < 0) throw new Error(`Unexpected git log output: ${line}`);
    return { sha: line.slice(0, separator), subject: line.slice(separator + 1) };
  });
}

export function verifyCommitRange(range, cwd = process.cwd()) {
  const commits = commitsForRange(range, cwd);
  const invalid = commits.filter((commit) => !isConventionalCommitMessage(commit.subject));
  if (invalid.length > 0) {
    throw new Error([
      "Invalid conventional commits:",
      ...invalid.map((commit) => `${commit.sha}\t${commit.subject}`),
      "Expected type(scope): description."
    ].join("\n"));
  }
  return commits;
}

function normalizeCommitRange(range) {
  const firstPush = /^(0{40})\.\.([0-9a-f]{40})$/i.exec(range);
  return firstPush?.[2] ?? range;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const range = resolveCommitRange(process.argv.slice(2));
    const commits = verifyCommitRange(range);
    console.log(`CONVENTIONAL COMMIT PASSED: ${commits.length} non-merge commit(s) in ${range}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Commit message validation failed.");
    process.exitCode = 1;
  }
}
