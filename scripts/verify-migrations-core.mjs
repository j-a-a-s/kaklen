import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const VERIFICATION_SCHEMA_PREFIX = "kaklen_migration_verify_";

export const CRITICAL_DATABASE_STRUCTURE = Object.freeze({
  tables: [
    "User",
    "EmailVerificationToken",
    "PasswordResetToken",
    "InAppNotification",
    "QuotationPublicLink",
    "QuotationChangeRequest",
    "WhatsAppNotification",
    "Payment",
    "PaymentAttempt",
    "PaymentWebhookEvent",
    "PaymentRefund",
    "PaymentReceipt",
    "ProviderProfile",
    "ProviderAnalyticsEvent"
  ],
  columns: {
    User: ["authVersion", "emailVerifiedAt"],
    EmailVerificationToken: ["tokenHash", "expiresAt", "sentAt", "usedAt", "revokedAt"],
    PasswordResetToken: ["tokenHash", "expiresAt", "sentAt", "usedAt", "revokedAt"],
    InAppNotification: ["organizationId", "userId", "type", "readAt"],
    QuotationPublicLink: ["organizationId", "quotationId", "tokenHash", "expiresAt", "revokedAt"],
    QuotationChangeRequest: ["organizationId", "quotationId", "publicLinkId", "comment"],
    WhatsAppNotification: ["organizationId", "quotationId", "status", "recipientHash"],
    Payment: [
      "organizationId",
      "quotationId",
      "status",
      "amount",
      "currency",
      "idempotencyKey",
      "externalReference",
      "checkoutTokenHash"
    ],
    PaymentAttempt: ["paymentId", "status"],
    PaymentWebhookEvent: ["organizationId", "paymentId", "providerEventId", "signatureValid", "processedAt"],
    PaymentRefund: ["paymentId", "amount", "status"],
    PaymentReceipt: ["paymentId", "receiptNumber"],
    ProviderProfile: ["organizationId", "sourceClientId", "status", "consentAt"],
    ProviderAnalyticsEvent: ["organizationId", "profileId", "event"]
  },
  indexes: [
    "EmailVerificationToken_tokenHash_key",
    "PasswordResetToken_tokenHash_key",
    "InAppNotification_organizationId_userId_readAt_idx",
    "QuotationPublicLink_tokenHash_key",
    "Payment_externalReference_key",
    "Payment_organizationId_idempotencyKey_key",
    "PaymentWebhookEvent_providerEventId_key",
    "PaymentReceipt_paymentId_key",
    "ProviderProfile_organizationId_sourceClientId_key",
    "ProviderProfile_organizationId_status_idx"
  ]
});

export function buildSchemaDatabaseUrl(databaseUrl, schemaName) {
  assertSafeVerificationSchemaName(schemaName);
  const url = new URL(databaseUrl);
  url.searchParams.set("schema", schemaName);
  return url.toString();
}

export function createVerificationSchemaName(now = Date.now(), random = Math.random()) {
  const suffix = Math.floor(random * 0x1000000)
    .toString(16)
    .padStart(6, "0");
  const schemaName = `${VERIFICATION_SCHEMA_PREFIX}${now}_${suffix}`;
  assertSafeVerificationSchemaName(schemaName);
  return schemaName;
}

export function assertSafeVerificationSchemaName(schemaName) {
  const pattern = new RegExp(`^${VERIFICATION_SCHEMA_PREFIX}[0-9]+_[a-f0-9]{6}$`);
  if (!pattern.test(schemaName)) {
    throw new Error("El nombre del schema temporal no cumple el formato seguro de Kaklen.");
  }
}

export function hasExecutableMigrationSql(content) {
  const withoutBlockComments = content.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLineComments = withoutBlockComments.replace(/--.*$/gm, "");
  return withoutLineComments.replace(/[;\s]/g, "").length > 0;
}

export function validateMigrationDirectories(migrationsRoot) {
  const directoryNames = readdirSync(migrationsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const issues = [];
  const timestamps = new Map();

  if (directoryNames.length === 0) {
    issues.push("No se encontraron migraciones Prisma.");
  }

  for (const directoryName of directoryNames) {
    if (!/^\d{14}_[a-z0-9_]+$/.test(directoryName)) {
      issues.push(`${directoryName}: nombre de migración inválido.`);
    } else {
      const timestamp = directoryName.slice(0, 14);
      const existing = timestamps.get(timestamp);
      if (existing) {
        issues.push(`${directoryName}: timestamp duplicado con ${existing}.`);
      } else {
        timestamps.set(timestamp, directoryName);
      }
    }
    const migrationPath = join(migrationsRoot, directoryName, "migration.sql");
    if (!existsSync(migrationPath)) {
      issues.push(`${directoryName}: falta migration.sql.`);
      continue;
    }
    if (!hasExecutableMigrationSql(readFileSync(migrationPath, "utf8"))) {
      issues.push(`${directoryName}: migration.sql no contiene SQL ejecutable.`);
    }
  }

  if (issues.length > 0) {
    throw new Error(["Historial de migraciones inválido:", ...issues.map((issue) => `- ${issue}`)].join("\n"));
  }

  return { count: directoryNames.length, names: directoryNames };
}

export function findCriticalStructureIssues(snapshot, expected = CRITICAL_DATABASE_STRUCTURE) {
  const tableNames = new Set(snapshot.tables);
  const indexNames = new Set(snapshot.indexes);
  const columnNames = new Set(snapshot.columns.map(({ table, column }) => `${table}.${column}`));
  const issues = [];

  for (const table of expected.tables) {
    if (!tableNames.has(table)) {
      issues.push(`falta tabla ${table}`);
    }
  }
  for (const [table, columns] of Object.entries(expected.columns)) {
    for (const column of columns) {
      if (!columnNames.has(`${table}.${column}`)) {
        issues.push(`falta columna ${table}.${column}`);
      }
    }
  }
  for (const index of expected.indexes) {
    if (!indexNames.has(index)) {
      issues.push(`falta índice ${index}`);
    }
  }

  return issues;
}
