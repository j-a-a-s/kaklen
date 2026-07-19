import { validateRuntimeEnvironment } from "@kaklen/config";

const SECRETS = {
  access: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  refresh: "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
  whatsapp: "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
  payment: "4e07408562bedb8b60ce05c1decfe3ad16b722309a7c3799cb11a4e0bdf3a4a9",
  rateLimit: "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a"
} as const;

describe("production runtime configuration", () => {
  it("accepts a complete production environment", () => {
    const config = validateRuntimeEnvironment(productionEnvironment());

    expect(config.api.nodeEnv).toBe("production");
    expect(config.api.swaggerEnabled).toBe(false);
    expect(config.redis.url).toBe("rediss://cache.kaklen.test");
  });

  it("rejects a missing required secret", () => {
    expect(() =>
      validateRuntimeEnvironment(productionEnvironment({ JWT_ACCESS_SECRET: undefined }))
    ).toThrow("JWT_ACCESS_SECRET is required in production");
  });

  it("rejects placeholders, low diversity, and equal JWT secrets", () => {
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({
          JWT_ACCESS_SECRET: "change-me-".padEnd(64, "a")
        })
      )
    ).toThrow("forbidden placeholder");
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ JWT_ACCESS_SECRET: "a".repeat(64) })
      )
    ).toThrow("repeated or low-diversity");
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ JWT_REFRESH_SECRET: SECRETS.access })
      )
    ).toThrow("must be different");
  });

  it("rejects insecure cookies and origins", () => {
    expect(() =>
      validateRuntimeEnvironment(productionEnvironment({ COOKIE_SECURE: "false" }))
    ).toThrow("COOKIE_SECURE must be true");
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ APP_PUBLIC_URL: "http://app.kaklen.test" })
      )
    ).toThrow("APP_PUBLIC_URL must use https");
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ APP_WEB_URL: "https://localhost" })
      )
    ).toThrow("localhost or loopback");
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ AUTH_ALLOWED_ORIGINS: "*" })
      )
    ).toThrow("wildcard or null");
  });

  it.each([
    ["credentials", "https://user:password@app.kaklen.test"],
    ["path", "https://app.kaklen.test/private"],
    ["double-slash path", "https://app.kaklen.test//"],
    ["query", "https://app.kaklen.test?debug=true"],
    ["fragment", "https://app.kaklen.test#debug"],
    ["loopback", "https://127.0.0.1"],
    ["IPv6 loopback", "https://[::1]"],
    ["wildcard host", "https://*.kaklen.test"]
  ])("rejects a production origin containing %s", (_case, origin) => {
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ CORS_ALLOWED_ORIGINS: origin })
      )
    ).toThrow();
  });

  it("keeps local defaults available in development", () => {
    const config = validateRuntimeEnvironment({ NODE_ENV: "development" });

    expect(config.api.databaseSsl).toBe(false);
    expect(config.auth.cookieSecure).toBe(false);
    expect(config.redis.url).toBe("redis://localhost:6379");
    expect(config.api.swaggerEnabled).toBe(true);
  });
});

function productionEnvironment(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://kaklen:private@db.kaklen.test:5432/kaklen",
    DATABASE_SSL: "true",
    APP_VERSION: "1.0.0",
    COMMIT_SHA: "abcdef1234567890",
    CORS_ALLOWED_ORIGINS: "https://app.kaklen.test",
    AWS_REGION: "us-east-1",
    AWS_S3_BUCKET: "kaklen-production",
    JWT_ACCESS_SECRET: SECRETS.access,
    JWT_REFRESH_SECRET: SECRETS.refresh,
    COOKIE_SECURE: "true",
    AUTH_ALLOWED_ORIGINS: "https://app.kaklen.test",
    APP_WEB_URL: "https://app.kaklen.test",
    APP_PUBLIC_URL: "https://app.kaklen.test",
    MAIL_FROM: "Kaklen <no-reply@kaklen.test>",
    MAIL_HOST: "smtp.kaklen.test",
    WHATSAPP_HASH_SECRET: SECRETS.whatsapp,
    PAYMENT_SANDBOX_SECRET: SECRETS.payment,
    RATE_LIMIT_HASH_SECRET: SECRETS.rateLimit,
    REDIS_URL: "rediss://cache.kaklen.test",
    ...overrides
  };
}
