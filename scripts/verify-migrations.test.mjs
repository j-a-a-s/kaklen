import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  assertSafeVerificationSchemaName,
  buildSchemaDatabaseUrl,
  createVerificationSchemaName,
  findCriticalStructureIssues,
  hasExecutableMigrationSql,
  validateMigrationDirectories
} from "./verify-migrations-core.mjs";

test("builds an isolated schema URL without changing the database target", () => {
  const source = "postgresql://user:secret@localhost:5432/kaklen?schema=public&sslmode=disable";
  const schema = createVerificationSchemaName(123456, 0.5);
  const result = new URL(buildSchemaDatabaseUrl(source, schema));

  assert.equal(result.hostname, "localhost");
  assert.equal(result.pathname, "/kaklen");
  assert.equal(result.searchParams.get("schema"), schema);
  assert.equal(result.searchParams.get("sslmode"), "disable");
});

test("accepts only generated verification schema names", () => {
  assert.doesNotThrow(() => assertSafeVerificationSchemaName("kaklen_migration_verify_123456_abcdef"));
  assert.throws(() => assertSafeVerificationSchemaName("public"), /formato seguro/);
  assert.throws(() => assertSafeVerificationSchemaName("kaklen_migration_verify_123;drop_schema"), /formato seguro/);
});

test("distinguishes executable SQL from empty or comment-only migrations", () => {
  assert.equal(hasExecutableMigrationSql("-- comment\n/* block */\n;"), false);
  assert.equal(hasExecutableMigrationSql('-- migration\nCREATE TABLE "Example" ("id" TEXT);'), true);
});

test("validates ordered migration directories and rejects incomplete entries", () => {
  const root = mkdtempSync(join(tmpdir(), "kaklen-migrations-"));
  try {
    const valid = join(root, "20260717000000_valid_migration");
    mkdirSync(valid);
    writeFileSync(join(valid, "migration.sql"), 'CREATE TABLE "Valid" ("id" TEXT);');
    assert.deepEqual(validateMigrationDirectories(root), {
      count: 1,
      names: ["20260717000000_valid_migration"]
    });

    const invalid = join(root, "20260717000001_empty_migration");
    mkdirSync(invalid);
    writeFileSync(join(invalid, "migration.sql"), "-- no executable SQL\n");
    assert.throws(() => validateMigrationDirectories(root), /no contiene SQL ejecutable/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rejects duplicate migration timestamps", () => {
  const root = mkdtempSync(join(tmpdir(), "kaklen-migrations-"));
  try {
    for (const name of ["20260717000000_first", "20260717000000_second"]) {
      const directory = join(root, name);
      mkdirSync(directory);
      writeFileSync(join(directory, "migration.sql"), `CREATE TABLE "${name}" ("id" TEXT);`);
    }
    assert.throws(() => validateMigrationDirectories(root), /timestamp duplicado/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("reports missing critical tables, columns, and indexes", () => {
  const expected = {
    tables: ["User"],
    columns: { User: ["authVersion"] },
    indexes: ["User_email_key"],
    foreignKeys: [
      {
        table: "User",
        constraint: "User_owner_fkey",
        deleteRule: "RESTRICT",
        updateRule: "CASCADE"
      }
    ]
  };
  assert.deepEqual(findCriticalStructureIssues({ tables: [], columns: [], indexes: [], foreignKeys: [] }, expected), [
    "falta tabla User",
    "falta columna User.authVersion",
    "falta índice User_email_key",
    "falta clave foránea User.User_owner_fkey"
  ]);
  assert.deepEqual(
    findCriticalStructureIssues(
      {
        tables: ["User"],
        columns: [{ table: "User", column: "authVersion" }],
        indexes: ["User_email_key"],
        foreignKeys: [
          {
            table: "User",
            constraint: "User_owner_fkey",
            deleteRule: "RESTRICT",
            updateRule: "CASCADE"
          }
        ]
      },
      expected
    ),
    []
  );
  assert.deepEqual(
    findCriticalStructureIssues(
      {
        tables: ["User"],
        columns: [{ table: "User", column: "authVersion" }],
        indexes: ["User_email_key"],
        foreignKeys: [
          {
            table: "User",
            constraint: "User_owner_fkey",
            deleteRule: "CASCADE",
            updateRule: "CASCADE"
          }
        ]
      },
      expected
    ),
    ["reglas inválidas en User.User_owner_fkey: delete=CASCADE, update=CASCADE"]
  );
});
