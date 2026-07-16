import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("password recovery schema and migration remain present", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model PasswordResetToken/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /authVersion\s+Int\s+@default\(0\)/);
  const migration = readdirSync("prisma/migrations").find((name) =>
    name.endsWith("add_password_reset_tokens")
  );
  assert.ok(migration, "add_password_reset_tokens migration is required");
});

test("password recovery keeps tokens out of logs and invalidates sessions", () => {
  const auth = read("apps/api/src/auth/auth.service.ts");
  const logging = read("apps/api/src/common/runtime-logging.ts");
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /refreshToken\.updateMany/);
  assert.match(auth, /authVersion: \{ increment: 1 \}/);
  assert.match(auth, /password_reset_completed/);
  assert.doesNotMatch(auth, /console\.(?:log|info|warn|error)/);
  assert.match(logging, /originalUrl\.split\("\?"\)/);
});

test("rate limits, localized templates, and Mailpit E2E are wired", () => {
  const limiter = read("apps/api/src/auth/password-recovery-rate-limit.service.ts");
  const templates = read("apps/api/src/notifications/templates.ts");
  const e2e = read("e2e/password-recovery.spec.mjs");
  assert.match(limiter, /forgot:email/);
  assert.match(limiter, /reset:token/);
  assert.match(limiter, /createHash\("sha256"\)/);
  assert.match(templates, /Recupera tu acceso a Kaklen/);
  assert.match(templates, /Reset your Kaklen password/);
  assert.match(templates, /Redefina sua senha do Kaklen/);
  assert.match(e2e, /\/api\/v1\/messages/);
  assert.match(e2e, /originalAccessToken/);
});

test("all localized catalogs include password recovery messages", () => {
  for (const locale of ["es", "en", "pt-BR"]) {
    const xlf = read(`apps/web/src/locale/messages.${locale}.xlf`);
    for (const id of [
      "forgotPasswordTitle",
      "resetPasswordTitle",
      "passwordUpdatedTitle",
      "usedTokenMessage"
    ]) {
      assert.match(xlf, new RegExp(`trans-unit id="${id}"`), `${locale} is missing ${id}`);
    }
  }
});
