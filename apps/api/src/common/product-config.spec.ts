import { readRedisConfig, validateRuntimeEnvironment } from "@kaklen/config";

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

  it.each([
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "WHATSAPP_HASH_SECRET",
    "PAYMENT_SANDBOX_SECRET",
    "RATE_LIMIT_HASH_SECRET",
    "REDIS_URL"
  ])("rejects a missing production value for %s", (key) => {
    expect(() =>
      validateRuntimeEnvironment(productionEnvironment({ [key]: undefined }))
    ).toThrow(`${key} is required in production`);
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
        productionEnvironment({
          JWT_ACCESS_SECRET: "0123456789abcdef0123456789abcde0".repeat(2)
        })
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
      validateRuntimeEnvironment(productionEnvironment({ DATABASE_SSL: undefined }))
    ).toThrow("DATABASE_SSL must be true");
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
    "postgresql://kaklen:private@db.kaklen.test:5432/kaklen",
    "postgresql://kaklen:private@db.kaklen.test:5432/kaklen?sslmode=disable",
    "postgresql://kaklen:private@db.kaklen.test:5432/kaklen?sslmode=prefer"
  ])("rejects a production database URL that does not require TLS", (databaseUrl) => {
    expect(() =>
      validateRuntimeEnvironment(productionEnvironment({ DATABASE_URL: databaseUrl }))
    ).toThrow("DATABASE_URL must include sslmode=require in production");
  });

  it.each([
    "APP_PUBLIC_URL",
    "APP_WEB_URL",
    "CORS_ALLOWED_ORIGINS",
    "AUTH_ALLOWED_ORIGINS"
  ])("requires an explicit HTTPS origin in %s", (key) => {
    expect(() =>
      validateRuntimeEnvironment(productionEnvironment({ [key]: undefined }))
    ).toThrow(`${key} is required in production`);
    expect(() =>
      validateRuntimeEnvironment(
        productionEnvironment({ [key]: "http://app.kaklen.test" })
      )
    ).toThrow(`${key} must use https`);
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

  it("accepts a managed production rediss URL with credentials and a database", () => {
    const config = readRedisConfig({
      NODE_ENV: "production",
      REDIS_URL: "rediss://cache-user:managed-password@cache.example:6380/4",
      RATE_LIMIT_HASH_SECRET: SECRETS.rateLimit
    });

    expect(config.url).toBe(
      "rediss://cache-user:managed-password@cache.example:6380/4"
    );
  });

  it("rejects unencrypted Redis in production without echoing the URL", () => {
    const redisUrl = "redis://cache-user:managed-password@cache.example:6379/4";

    expect(() =>
      readRedisConfig({
        NODE_ENV: "production",
        REDIS_URL: redisUrl,
        RATE_LIMIT_HASH_SECRET: SECRETS.rateLimit
      })
    ).toThrow("REDIS_URL must use rediss in production");

    try {
      readRedisConfig({
        NODE_ENV: "production",
        REDIS_URL: redisUrl,
        RATE_LIMIT_HASH_SECRET: SECRETS.rateLimit
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(redisUrl);
      expect((error as Error).message).not.toContain("managed-password");
    }
  });

  it.each([
    "rediss://localhost:6379",
    "rediss://cache.localhost:6379",
    "rediss://127.0.0.1:6379",
    "rediss://127.42.0.8:6379",
    "rediss://[::1]:6379",
    "rediss://0.0.0.0:6379"
  ])("rejects a production loopback Redis endpoint", (redisUrl) => {
    expect(() =>
      readRedisConfig({
        NODE_ENV: "production",
        REDIS_URL: redisUrl,
        RATE_LIMIT_HASH_SECRET: SECRETS.rateLimit
      })
    ).toThrow("localhost or loopback");
  });

  it.each(["redis://localhost:6379/1", "rediss://cache.example:6380/2"])(
    "allows redis and rediss endpoints outside production",
    (redisUrl) => {
      expect(
        readRedisConfig({
          NODE_ENV: "development",
          REDIS_URL: redisUrl,
          RATE_LIMIT_HASH_SECRET: "local-rate-limit-secret"
        }).url
      ).toBe(redisUrl);
    }
  );
});

function productionEnvironment(
  overrides: Record<string, string | undefined> = {}
): Record<string, string | undefined> {
  return {
    NODE_ENV: "production",
    DATABASE_URL: "postgresql://kaklen:private@db.kaklen.test:5432/kaklen?sslmode=require",
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
