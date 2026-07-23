import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import {
  CODEOWNERS_LINES,
  LICENSE_TEXT,
  REPOSITORY_GOVERNANCE,
  compareRemoteGovernance,
  loadGovernanceDocuments,
  validateCodeowners,
  validateGovernanceDocuments,
  validateLicenseText,
  validatePrivatePackageLicenses,
  validateRepositoryMetadata,
  verifyGovernanceContract
} from "./governance-contract-core.mjs";

const ROOT = resolve(import.meta.dirname, "..");

test("the repository satisfies the complete local governance contract", () => {
  const result = verifyGovernanceContract(ROOT);

  assert.deepEqual(result.errors, []);
  assert.equal(result.packageCount, 6);
});

test("the proprietary license must match byte for byte", () => {
  assert.deepEqual(validateLicenseText(LICENSE_TEXT), []);
  assert.match(
    validateLicenseText(LICENSE_TEXT.replace("All rights reserved.", "Some rights reserved."))[0],
    /canonical proprietary license/
  );
});

test("every private workspace package is UNLICENSED and OSS declarations fail", () => {
  assert.deepEqual(
    validatePrivatePackageLicenses([
      { path: "package.json", manifest: { private: true, license: "UNLICENSED" } }
    ]),
    []
  );
  assert.match(
    validatePrivatePackageLicenses([
      { path: "package.json", manifest: { private: true } }
    ])[0],
    /UNLICENSED/
  );
  assert.match(
    validatePrivatePackageLicenses([
      { path: "package.json", manifest: { private: true, license: "MIT" } }
    ])[0],
    /open-source license/
  );
});

test("CODEOWNERS must preserve every canonical ownership rule", () => {
  const content = `${CODEOWNERS_LINES.join("\n")}\n`;

  assert.deepEqual(validateCodeowners(content), []);
  assert.match(
    validateCodeowners(content.replace("/prisma/ @j-a-a-s\n", ""))[0],
    /canonical policy/
  );
});

test("governance documents and templates contain every required policy", () => {
  const documents = loadGovernanceDocuments(ROOT);

  assert.deepEqual(validateGovernanceDocuments(documents), []);

  const contributionFailure = new Map(documents);
  contributionFailure.set(
    "CONTRIBUTING.md",
    contributionFailure
      .get("CONTRIBUTING.md")
      .replace("prior written authorization from `j-a-a-s`", "approval")
  );
  assert.match(
    validateGovernanceDocuments(contributionFailure)[0],
    /CONTRIBUTING\.md/
  );

  const securityFailure = new Map(documents);
  securityFailure.set(
    "SECURITY.md",
    securityFailure.get("SECURITY.md").replace(
      "https://github.com/j-a-a-s/kaklen/security/advisories/new",
      "public issue"
    )
  );
  assert.match(validateGovernanceDocuments(securityFailure)[0], /SECURITY\.md/);
});

test("contradictory open-source ownership claims are rejected", () => {
  const documents = new Map([
    ["README.md", "Kaklen es software de código abierto."]
  ]);
  const errors = validateGovernanceDocuments(documents);

  assert.ok(errors.some((error) => /contradicts/.test(error)));
});

test("repository metadata must match the canonical JSON contract", () => {
  const metadata = clone(REPOSITORY_GOVERNANCE);

  assert.deepEqual(validateRepositoryMetadata(metadata), []);
  metadata.description = "Different description";
  assert.match(validateRepositoryMetadata(metadata)[0], /canonical repository policy/);
});

test("missing governance files fail closed", () => {
  const emptyRoot = mkdtempSync(join(tmpdir(), "kaklen-governance-"));
  const result = verifyGovernanceContract(emptyRoot);

  assert.ok(result.errors.some((error) => error.includes("LICENSE")));
  assert.ok(result.errors.some((error) => error.includes("CODEOWNERS")));
  assert.ok(result.errors.some((error) => error.includes("SECURITY.md")));
});

test("remote governance comparison accepts only the exact repository state", () => {
  const expected = clone(REPOSITORY_GOVERNANCE);
  const actual = remoteState(expected);

  assert.deepEqual(compareRemoteGovernance(expected, actual), []);
  const mismatches = [
    { ...actual, description: "Different" },
    { ...actual, topics: [...actual.topics, "extra"] },
    { ...actual, visibility: "private" },
    { ...actual, defaultBranch: "develop" },
    { ...actual, homepage: "https://example.invalid" },
    { ...actual, privateVulnerabilityReporting: false }
  ];
  for (const mismatch of mismatches) {
    assert.ok(compareRemoteGovernance(expected, mismatch).length > 0);
  }
});

function remoteState(expected) {
  return {
    repository: expected.repository,
    visibility: expected.visibility,
    defaultBranch: expected.defaultBranch,
    description: expected.description,
    homepage: expected.homepage,
    topics: [...expected.topics].reverse(),
    privateVulnerabilityReporting: expected.privateVulnerabilityReporting
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}
