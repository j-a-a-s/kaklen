import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIG_ROLLBACK_PATHS,
  KAKLEN_PRE_CONFIG_SHA,
  KOKECORE_PRE_CONFIG_SHA,
  validateRestoredConfigDependency
} from "./verify-config-rollback.mjs";

const expectedLink = "link:../../../kokecore/packages/config";
const restoredLockfile = `
apps/api:
  '@kokecore/config':
    specifier: ${expectedLink}
packages/config:
  '@kokecore/config':
    specifier: ${expectedLink}
`;

test("defines an immutable Config rollback baseline", () => {
  assert.match(KAKLEN_PRE_CONFIG_SHA, /^[a-f0-9]{40}$/);
  assert.match(KOKECORE_PRE_CONFIG_SHA, /^[a-f0-9]{40}$/);
  assert.deepEqual(CONFIG_ROLLBACK_PATHS, [
    "apps/api/package.json",
    "packages/config/package.json",
    "packages/config/src/index.ts",
    "pnpm-lock.yaml"
  ]);
});

test("accepts the exact previous local-link dependency contract", () => {
  assert.deepEqual(
    validateRestoredConfigDependency(
      { dependencies: { "@kokecore/config": expectedLink } },
      { dependencies: { "@kokecore/config": expectedLink } },
      restoredLockfile
    ),
    []
  );
});

test("rejects an incomplete rollback or residual tarball", () => {
  const errors = validateRestoredConfigDependency(
    { dependencies: {} },
    { dependencies: { "@kokecore/config": expectedLink } },
    `${restoredLockfile}\nkokecore-config-0.2.0.tgz\n`
  );
  assert.ok(errors.some((error) => error.includes("API Config dependency")));
  assert.ok(errors.some((error) => error.includes("tarball remains")));
});
