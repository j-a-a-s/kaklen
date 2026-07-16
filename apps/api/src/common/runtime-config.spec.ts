import { readApiConfig, readPasswordRecoveryConfig } from "@kaklen/config";

describe("runtime config", () => {
  it("fails fast when production required settings are missing", () => {
    expect(() => readApiConfig({ NODE_ENV: "production" })).toThrow("DATABASE_URL is required in production");
  });

  it("requires database SSL in production", () => {
    expect(() =>
      readApiConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://example",
        DATABASE_SSL: "false",
        APP_VERSION: "1.0.0",
        COMMIT_SHA: "abc",
        CORS_ALLOWED_ORIGINS: "https://app.example.com",
        AWS_REGION: "us-east-1",
        AWS_S3_BUCKET: "bucket"
      })
    ).toThrow("DATABASE_SSL must be true in production");
  });

  it("parses allowed CORS origins", () => {
    expect(
      readApiConfig({
        CORS_ALLOWED_ORIGINS: "https://a.example.com, https://b.example.com"
      }).corsAllowedOrigins
    ).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("parses password recovery and local Mailpit settings", () => {
    expect(
      readPasswordRecoveryConfig({
        APP_PUBLIC_URL: "http://localhost:4200/",
        PASSWORD_RESET_EXPIRES_MINUTES: "45",
        MAIL_HOST: "localhost",
        MAIL_PORT: "1025"
      })
    ).toMatchObject({
      appPublicUrl: "http://localhost:4200",
      expiresMinutes: 45,
      mailHost: "localhost",
      mailPort: 1025,
      mailSecure: false
    });
  });

  it("rejects incomplete SMTP credentials", () => {
    expect(() => readPasswordRecoveryConfig({ MAIL_USER: "mailer" })).toThrow(
      "MAIL_USER and MAIL_PASSWORD must be configured together"
    );
  });
});
