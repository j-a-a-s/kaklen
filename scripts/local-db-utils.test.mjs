import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyPostgresError,
  classifyPrismaError,
  compareDatabaseUrlWithContainer,
  isMigrationDriftOutput,
  parseDatabaseUrl,
  setupFailureMessage,
  summarizeCommandFailure
} from "./local-db-utils.mjs";

const parsed = parseDatabaseUrl("postgresql://kaklen:wrong@localhost:5432/kaklen_dev?schema=public");

test("classifies invalid PostgreSQL credentials", () => {
  const result = classifyPostgresError({ code: "28P01", message: "password authentication failed" }, parsed);

  assert.equal(result.type, "auth");
  assert.equal(setupFailureMessage(result), "Credenciales inválidas en DATABASE_URL.");
  assert.equal(setupFailureMessage(result).includes("Proyecto listo"), false);
});

test("classifies unavailable PostgreSQL server", () => {
  const result = classifyPostgresError({ code: "ECONNREFUSED", message: "connect ECONNREFUSED" }, parsed);

  assert.equal(result.type, "unavailable");
});

test("classifies missing PostgreSQL database", () => {
  const result = classifyPostgresError({ code: "3D000", message: "database does not exist" }, parsed);

  assert.equal(result.type, "missing-db");
  assert.equal(result.message, "Base kaklen_dev no existe.");
});

test("classifies Prisma P1000 P1001 and P1003", () => {
  assert.equal(classifyPrismaError({ errorCode: "P1000" }).type, "auth");
  assert.equal(classifyPrismaError({ errorCode: "P1001" }).type, "unavailable");
  assert.equal(classifyPrismaError({ errorCode: "P1003" }).type, "missing-db");
});

test("accepts an environment matching the active PostgreSQL container", () => {
  const comparison = compareDatabaseUrlWithContainer(
    "postgresql://kaklen:kaklen_dev_password@localhost:5432/kaklen_dev?schema=public",
    { user: "kaklen", password: "kaklen_dev_password", database: "kaklen_dev" }
  );

  assert.equal(comparison.matches, true);
});

test("detects DATABASE_URL mismatches without exposing passwords", () => {
  const comparison = compareDatabaseUrlWithContainer(
    "postgresql://kaklen:wrong@localhost:5432/kaklen?schema=public",
    { user: "kaklen", password: "kaklen_dev_password", database: "kaklen_dev" }
  );

  assert.equal(comparison.matches, false);
  assert.equal(comparison.mismatches.some((item) => item.includes("kaklen_dev_password")), false);
});

test("detects Prisma migration drift output", () => {
  assert.equal(isMigrationDriftOutput("Drift detected: Your database schema is not in sync."), true);
  assert.equal(isMigrationDriftOutput("Your local migration history and the migrations table from your database are different."), true);
  assert.equal(isMigrationDriftOutput("Database schema is up to date."), false);
});

test("summarizes command failures without stack traces", () => {
  const lines = summarizeCommandFailure({ stderr: "first\n\nsecond", stdout: "", message: "ignored" });

  assert.deepEqual(lines.slice(0, 2), ["first", "second"]);
});
