import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  isConventionalCommitMessage,
  resolveCommitRange,
  verifyCommitMessage,
  verifyCommitRange
} from "./verify-commit-message.mjs";

for (const message of [
  "feat(auth): add session rotation",
  "fix(quotations): enforce complete response money parity",
  "test(mvp-e2e): cover persisted totals",
  "ci(quality/gate): verify commit subjects",
  "chore(repo.config): align tooling"
]) {
  test(`accepts conventional commit: ${message}`, () => {
    assert.equal(isConventionalCommitMessage(message), true);
    assert.equal(verifyCommitMessage(message), message);
  });
}

test("validates every non-merge commit in a valid range", () => withRepository((repository) => {
  const base = commit(repository, "chore(repo): initialize fixture", "base.txt");
  commit(repository, "fix(api): validate range", "api.txt");
  commit(repository, "test(ci): cover valid history", "test.txt");

  const commits = verifyCommitRange(`${base}..HEAD`, repository);

  assert.deepEqual(commits.map((entry) => entry.subject), [
    "test(ci): cover valid history",
    "fix(api): validate range"
  ]);
}));

test("reports an invalid intermediate commit with its SHA and subject", () => withRepository((repository) => {
  const base = commit(repository, "chore(repo): initialize fixture", "base.txt");
  const invalidSha = commit(repository, "temporary broken subject", "invalid.txt");
  commit(repository, "fix(ci): finish range", "final.txt");

  assert.throws(() => verifyCommitRange(`${base}..HEAD`, repository), (error) => {
    assert.match(error.message, new RegExp(invalidSha));
    assert.match(error.message, /temporary broken subject/);
    return true;
  });
}));

test("ignores merge commit subjects while checking their non-merge commits", () => withRepository((repository) => {
  const base = commit(repository, "chore(repo): initialize fixture", "base.txt");
  git(repository, "checkout", "-b", "topic");
  commit(repository, "feat(api): add topic", "topic.txt");
  git(repository, "checkout", "main");
  commit(repository, "docs(repo): update main", "main.txt");
  git(repository, "merge", "--no-ff", "topic", "-m", "Merge topic into main");

  const commits = verifyCommitRange(`${base}..HEAD`, repository);

  assert.equal(commits.length, 2);
  assert.equal(commits.some((entry) => entry.subject.startsWith("Merge ")), false);
}));

test("treats an all-zero push base as the current commit only", () => withRepository((repository) => {
  const sha = commit(repository, "fix(ci): validate first push", "first.txt");
  const range = resolveCommitRange([], { COMMIT_RANGE: `${"0".repeat(40)}..${sha}` });

  assert.equal(range, sha);
  assert.deepEqual(verifyCommitRange(range, repository).map((entry) => entry.sha), [sha]);
}));

test("falls back to HEAD without validating older history", () => withRepository((repository) => {
  commit(repository, "legacy invalid subject", "legacy.txt");
  const head = commit(repository, "fix(ci): validate head fallback", "head.txt");

  const range = resolveCommitRange([], {});
  const commits = verifyCommitRange(range, repository);

  assert.equal(range, "HEAD");
  assert.deepEqual(commits.map((entry) => entry.sha), [head]);
}));

test("prefers an explicit range over COMMIT_RANGE", () => {
  assert.equal(resolveCommitRange(["--range", "base..head"], { COMMIT_RANGE: "other..range" }), "base..head");
  assert.throws(() => resolveCommitRange(["--range"], {}), /requires a commit range/);
});

function withRepository(run) {
  const repository = mkdtempSync(join(tmpdir(), "kaklen-commit-range-"));
  try {
    git(repository, "init", "-b", "main");
    git(repository, "config", "user.email", "quality@kaklen.local");
    git(repository, "config", "user.name", "Kaklen Quality");
    return run(repository);
  } finally {
    rmSync(repository, { recursive: true, force: true });
  }
}

function commit(repository, subject, filename) {
  writeFileSync(join(repository, filename), `${subject}\n`);
  git(repository, "add", filename);
  git(repository, "commit", "-m", subject);
  return git(repository, "rev-parse", "HEAD").trim();
}

function git(repository, ...args) {
  return execFileSync("git", args, { cwd: repository, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

for (const message of [
  "Fix: quotation",
  "Fix: multiples errors",
  "Commit propuesto: fix quotation",
  "fix: missing scope",
  "fix(): empty scope",
  "feature(auth): unsupported type",
  "fix(auth):"
]) {
  test(`rejects non-conventional commit: ${message}`, () => {
    assert.equal(isConventionalCommitMessage(message), false);
    assert.throws(() => verifyCommitMessage(message), /Expected type\(scope\): description/);
  });
}
