import assert from "node:assert/strict";
import test from "node:test";

import {
  CONFIG_ISSUE_CODES,
  coerceBoolean,
  coerceInteger,
  defineConfigSchema,
  readString,
  validateEnvironment
} from "@kokecore/config";

import {
  readApiConfig,
  readPasswordRecoveryConfig,
  validateRuntimeEnvironment
} from "../dist/index.js";

test("resolves the certified package root and composes neutral schemas", () => {
  const schema = defineConfigSchema(["HOST", "PORT"], (environment) => ({
    host: readString(environment, "HOST"),
    port: coerceInteger(environment.PORT, {
      key: "PORT",
      defaultValue: 3000,
      minimum: 1
    })
  }));

  assert.deepEqual(
    validateEnvironment(
      schema,
      { HOST: "localhost", PORT: "3100" },
      {
        unknownVariables: "reject"
      }
    ),
    { host: "localhost", port: 3100 }
  );
  assert.equal(CONFIG_ISSUE_CODES.INVALID_VALUE, "CONFIG_INVALID_VALUE");
});

test("preserves Kaklen local and test defaults", () => {
  const development = validateRuntimeEnvironment({ NODE_ENV: "development" });
  const testing = readApiConfig({ NODE_ENV: "test" });

  assert.equal(development.api.port, 3000);
  assert.equal(development.api.databaseSsl, false);
  assert.equal(development.auth.cookieSecure, false);
  assert.equal(testing.nodeEnv, "test");
  assert.equal(testing.swaggerEnabled, true);
});

test("preserves boolean, integer, list, and optional-string behavior", () => {
  const api = readApiConfig({
    NODE_ENV: "test",
    SWAGGER_ENABLED: " yes ",
    CORS_ALLOWED_ORIGINS: " https://one.example, ,https://two.example ",
    AWS_S3_ENDPOINT: "  http://localhost:9000  "
  });
  const recovery = readPasswordRecoveryConfig({
    NODE_ENV: "test",
    MAIL_CONNECTION_TIMEOUT_MS: "250",
    MAIL_USER: "   "
  });

  assert.equal(api.swaggerEnabled, true);
  assert.deepEqual(api.corsAllowedOrigins, ["https://one.example", "https://two.example"]);
  assert.equal(api.awsS3Endpoint, "http://localhost:9000");
  assert.equal(recovery.mailConnectionTimeoutMs, 250);
  assert.equal(recovery.mailUser, undefined);
});

test("preserves invalid-value messages and does not include rejected values", () => {
  const sensitiveValue = "test-only-sensitive-invalid-value";
  assert.throws(
    () => coerceBoolean(sensitiveValue, { key: "FEATURE" }),
    (error) => {
      assert.equal(error.code, CONFIG_ISSUE_CODES.INVALID_VALUE);
      assert.equal(error.message, "FEATURE must be a boolean");
      assert.equal(error.message.includes(sensitiveValue), false);
      return true;
    }
  );
  assert.throws(() => readApiConfig({ NODE_ENV: "test", SWAGGER_ENABLED: sensitiveValue }), {
    message: "SWAGGER_ENABLED must be a boolean"
  });
  assert.throws(() => readPasswordRecoveryConfig({ MAIL_CONNECTION_TIMEOUT_MS: "99" }), {
    message: "MAIL_CONNECTION_TIMEOUT_MS must be an integer between 100 and 120000"
  });
});

test("keeps Kaklen production policy in the application package", () => {
  assert.throws(() => readApiConfig({ NODE_ENV: "production" }), {
    message: "DATABASE_URL is required in production"
  });
  assert.throws(
    () =>
      readApiConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://database.example/app?sslmode=require",
        DATABASE_SSL: "false",
        APP_VERSION: "1.0.0",
        COMMIT_SHA: "abc123",
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        AWS_REGION: "us-east-1",
        AWS_S3_BUCKET: "app-production"
      }),
    { message: "DATABASE_SSL must be true in production" }
  );
});
