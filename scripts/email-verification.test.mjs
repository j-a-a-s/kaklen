import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20260716230000_require_verified_email/migration.sql");
const authService = read("apps/api/src/auth/auth.service.ts");
const authController = read("apps/api/src/auth/auth.controller.ts");
const mailService = read("apps/api/src/notifications/mail.service.ts");
const webAuth = read("apps/web/src/app/auth/auth.service.ts");
const registerComponent = read("apps/web/src/app/pages/register.component.ts");
const routes = read("apps/web/src/main.ts");
const e2e = read("e2e/email-verification.spec.mjs");

test("schema separates account status from mandatory email verification", () => {
  assert.match(schema, /emailVerifiedAt\s+DateTime\?/);
  assert.match(schema, /model EmailVerificationToken \{/);
  for (const field of ["tokenHash", "expiresAt", "usedAt", "revokedAt", "sentAt", "createdAt"]) {
    assert.match(schema, new RegExp(`\\b${field}\\b`));
  }
  for (const status of ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"]) {
    assert.match(schema, new RegExp(`\\b${status}\\b`));
  }
  assert.match(migration, /ADD COLUMN "emailVerifiedAt"/);
  assert.match(migration, /CREATE TABLE "EmailVerificationToken"/);
  assert.match(migration, /UPDATE "User" SET "emailVerifiedAt"/);
});

test("registration persists a pending account and cannot issue a session", () => {
  const register = method(authService, "async register", "async login");
  const controllerRegister = method(authController, "  register(", "  @Post(\"login\")");
  assert.match(register, /emailVerifiedAt: null/);
  assert.match(register, /createEmailVerificationToken/);
  assert.match(register, /deliverEmailVerification/);
  assert.doesNotMatch(register, /issueTokens|refreshToken\.create/);
  assert.doesNotMatch(controllerRegister, /setRefreshCookie|@Res/);
  assert.match(webAuth, /register\(payload: RegisterRequest\): Promise<MessageResponse>/);
  assert.doesNotMatch(method(webAuth, "  register(", "  login("), /applyAuthResponse|withCredentials/);
  assert.doesNotMatch(registerComponent, /navigateByUrl\(\"\/dashboard\"\)|private readonly router: Router/);
});

test("login and all authenticated session paths require verified email", () => {
  const login = method(authService, "async login", "async verifyEmail");
  assert.match(login, /!user\.emailVerifiedAt/);
  assert.match(login, /EMAIL_NOT_VERIFIED|emailNotVerified/);
  assert.ok(login.indexOf("emailVerifiedAt") < login.indexOf("issueTokens"));
  assert.match(authService, /user: \{ status: UserStatus\.ACTIVE, emailVerifiedAt: \{ not: null \} \}/);
  assert.match(authService, /status: UserStatus\.ACTIVE, emailVerifiedAt: \{ not: null \}/);
});

test("verification tokens are random, hashed, single-use, expiring, and rotated", () => {
  assert.match(authService, /randomBytes\(48\)\.toString\("base64url"\)/);
  assert.match(authService, /createHash\("sha256"\)/);
  assert.match(authService, /sentAt: \{ not: null \}/);
  assert.match(authService, /usedAt: null/);
  assert.match(authService, /revokedAt: null/);
  assert.match(authService, /expiresAt: \{ gt: now \}/);
  assert.match(authService, /data: \{ usedAt: now \}/);
  assert.match(authService, /data: \{ revokedAt: now \}/);
});

test("SMTP success depends on provider acceptance and logs contain no message content", () => {
  assert.match(mailService, /await this\.transporter\.sendMail/);
  assert.match(mailService, /accepted\.includes\(recipient\)/);
  assert.match(mailService, /rejected\.includes\(recipient\)/);
  const successLog = method(mailService, "  private logSuccess", "  private logFailure");
  assert.match(successLog, /mailType|recipient|locale|messageId|accepted|rejected|timestamp/);
  assert.doesNotMatch(successLog, /message\.text|message\.html|resetUrl|verificationUrl|token/);
});

test("public UI exposes localized verification and resend routes", () => {
  assert.match(routes, /path: "verify-email", component: VerifyEmailComponent/);
  assert.match(routes, /path: "resend-verification", component: ResendVerificationComponent/);
  for (const locale of ["es", "en", "pt-BR"]) {
    const messages = read(`apps/web/src/locale/messages.${locale}.xlf`);
    for (const id of [
      "emailNotVerifiedMessage",
      "registerCheckEmailTitle",
      "resendVerificationAction",
      "emailConfirmedTitle",
      "verificationExpiredTitle"
    ]) {
      assert.match(messages, new RegExp(`<trans-unit id="${id}"`));
    }
  }
});

test("real E2E covers pending login, Mailpit delivery, rotation, and recovery exclusion", () => {
  assert.match(e2e, /clearMailpit/);
  assert.match(e2e, /EMAIL_NOT_VERIFIED/);
  assert.match(e2e, /waitForMailpitEmail/);
  assert.match(e2e, /EMAIL_VERIFICATION_TOKEN_REVOKED/);
  assert.match(e2e, /EMAIL_VERIFICATION_TOKEN_USED/);
  assert.match(e2e, /passwordResetToken\.count/);
  assert.doesNotMatch(e2e, /test\.skip|\.skip\(|waitForTimeout|new Promise[^;]+setTimeout/);
});

function method(source, start, end) {
  const startIndex = source.indexOf(start);
  assert.notEqual(startIndex, -1, `Missing section start: ${start}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `Missing section end: ${end}`);
  return source.slice(startIndex, endIndex);
}

function read(path) {
  return readFileSync(path, "utf8");
}
