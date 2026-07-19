import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("password recovery schema and migration remain present", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(schema, /model PasswordResetToken/);
  assert.match(schema, /tokenHash\s+String\s+@unique/);
  assert.match(schema, /sentAt\s+DateTime\?/);
  assert.match(schema, /authVersion\s+Int\s+@default\(0\)/);
  const migration = readdirSync("prisma/migrations").find((name) =>
    name.endsWith("add_password_reset_tokens")
  );
  assert.ok(migration, "add_password_reset_tokens migration is required");
  const sentAtMigration = readdirSync("prisma/migrations").find((name) =>
    name.endsWith("add_password_reset_sent_at")
  );
  assert.ok(sentAtMigration, "add_password_reset_sent_at migration is required");
});

test("password recovery queues delivery, keeps tokens out of logs, and invalidates sessions", () => {
  const auth = read("apps/api/src/auth/auth.service.ts");
  const processor = read("apps/api/src/auth/auth-delivery.processor.ts");
  const queue = read("apps/api/src/auth/auth-delivery-queue.service.ts");
  const logging = read("apps/api/src/common/runtime-logging.ts");
  assert.match(auth, /createHash\("sha256"\)/);
  assert.match(auth, /refreshToken\.updateMany/);
  assert.match(auth, /authVersion: \{ increment: 1 \}/);
  assert.match(auth, /password_reset_completed/);
  assert.match(auth, /enqueuePasswordReset/);
  assert.match(processor, /sendPasswordResetEmail/);
  assert.match(processor, /data: \{ sentAt: new Date\(\) \}/);
  assert.match(queue, /ipHash: this\.rateLimits\.hashSensitive/);
  assert.doesNotMatch(queue, /rawToken|resetUrl|verificationUrl/);
  assert.doesNotMatch(auth, /console\.(?:log|info|warn|error)/);
  assert.match(logging, /originalUrl\.split\("\?"\)/);
});

test("distributed rate limits, durable delivery, templates, and Mailpit E2E are wired", () => {
  const limiter = read("apps/api/src/auth/auth-rate-limit.service.ts");
  const distributedLimiter = read(
    "apps/api/src/security/distributed-rate-limit.service.ts"
  );
  const queue = read("apps/api/src/auth/auth-delivery-queue.service.ts");
  const templates = read("apps/api/src/notifications/templates.ts");
  const e2e = read("e2e/password-recovery.spec.mjs");
  const mail = read("apps/api/src/notifications/mail.service.ts");
  const packageJson = JSON.parse(read("package.json"));
  assert.match(limiter, /forgot-password:email/);
  assert.match(limiter, /reset-password:token/);
  assert.match(limiter, /createHash\("sha256"\)/);
  assert.match(distributedLimiter, /createHmac\("sha256"/);
  assert.match(distributedLimiter, /client\.call\("EVAL"/);
  assert.match(queue, /attempts: 3/);
  assert.match(queue, /backoff: \{ type: "exponential", delay: 500 \}/);
  assert.match(templates, /Recupera tu acceso a Kaklen/);
  assert.match(templates, /Reset your Kaklen password/);
  assert.match(templates, /Redefina sua senha do Kaklen/);
  assert.match(e2e, /\/api\/v1\/messages/);
  assert.match(e2e, /originalAccessToken/);
  assert.match(e2e, /empresa\.angela@demo\.kaklen\.local/);
  assert.match(e2e, /sentAt/);
  assert.match(mail, /\[mail:sent\]/);
  assert.match(mail, /accepted\.includes\(recipient\)/);
  assert.match(mail, /verifyConnection/);
  assert.doesNotMatch(mail, /resetUrl.*logger|logger.*resetUrl/);
  assert.equal(packageJson.scripts["mail:verify"], "node scripts/run-mail-verify.mjs");
  const mailRunner = read("scripts/run-mail-verify.mjs");
  assert.match(mailRunner, /MAIL_REUSE_CONFIG_BUILD/);
  assert.match(mailRunner, /scripts\/mail-verify\.ts/);
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
