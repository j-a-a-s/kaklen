import assert from "node:assert/strict";
import test from "node:test";
import { isConventionalCommitMessage, verifyCommitMessage } from "./verify-commit-message.mjs";

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
