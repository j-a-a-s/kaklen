export interface ApiConfig {
  nodeEnv: "development" | "test" | "production";
  port: number;
  databaseUrl: string;
  databaseSsl: boolean;
  appVersion: string;
  commitSha: string;
  buildTime: string;
  corsAllowedOrigins: string[];
  awsRegion: string;
  awsS3Bucket: string;
  awsS3Endpoint?: string;
  awsCloudFrontDomain?: string;
  logLevel: "debug" | "info" | "warn" | "error";
  trustProxy: boolean;
}

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresSeconds: number;
  jwtRefreshExpiresSeconds: number;
  cookieSecure: boolean;
  authAllowedOrigins: string[];
}

export interface OrganizationConfig {
  organizationInvitationExpiresSeconds: number;
  appWebUrl: string;
}

export interface PasswordRecoveryConfig {
  appPublicUrl: string;
  expiresMinutes: number;
  mailFrom: string;
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailUser?: string;
  mailPassword?: string;
}

const LOCAL_DATABASE_URL = "postgresql://kaklen:kaklen_dev_password@localhost:5432/kaklen_dev?schema=public";
const LOCAL_ORIGIN = "http://localhost:4200";

export function readApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const port = Number(env.PORT ?? env.API_PORT ?? 3000);
  const databaseUrl = requireString(env, "DATABASE_URL", isProduction, LOCAL_DATABASE_URL);
  const databaseSsl = parseBoolean(env.DATABASE_SSL, isProduction);
  const appVersion = requireString(env, "APP_VERSION", isProduction, env.npm_package_version ?? "0.1.0");
  const commitSha = requireString(env, "COMMIT_SHA", isProduction, "local");
  const buildTime = env.BUILD_TIME ?? new Date().toISOString();
  const corsAllowedOrigins = parseList(
    requireString(env, "CORS_ALLOWED_ORIGINS", isProduction, env.AUTH_ALLOWED_ORIGINS ?? LOCAL_ORIGIN)
  );
  const awsRegion = requireString(env, "AWS_REGION", isProduction, "us-east-1");
  const awsS3Bucket = requireString(env, "AWS_S3_BUCKET", isProduction, "kaklen-local");
  const logLevel = parseLogLevel(env.LOG_LEVEL ?? (isProduction ? "info" : "debug"));

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT must be a positive integer");
  }

  if (isProduction && !databaseSsl) {
    throw new Error("DATABASE_SSL must be true in production");
  }

  if (corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must include at least one origin");
  }

  return {
    nodeEnv,
    port,
    databaseUrl,
    databaseSsl,
    appVersion,
    commitSha,
    buildTime,
    corsAllowedOrigins,
    awsRegion,
    awsS3Bucket,
    awsS3Endpoint: optionalString(env.AWS_S3_ENDPOINT),
    awsCloudFrontDomain: optionalString(env.AWS_CLOUDFRONT_DOMAIN),
    logLevel,
    trustProxy: parseBoolean(env.TRUST_PROXY, false)
  };
}

export function readOrganizationConfig(env: Record<string, string | undefined>): OrganizationConfig {
  const organizationInvitationExpiresSeconds = Number(
    env.ORGANIZATION_INVITATION_EXPIRES_SECONDS ?? 259200
  );
  const appWebUrl = env.APP_WEB_URL ?? "http://localhost:4200";

  if (
    !Number.isInteger(organizationInvitationExpiresSeconds) ||
    organizationInvitationExpiresSeconds <= 0
  ) {
    throw new Error("ORGANIZATION_INVITATION_EXPIRES_SECONDS must be a positive integer");
  }

  return {
    organizationInvitationExpiresSeconds,
    appWebUrl
  };
}

export function readPasswordRecoveryConfig(
  env: Record<string, string | undefined>
): PasswordRecoveryConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const appPublicUrl = requireString(
    env,
    "APP_PUBLIC_URL",
    isProduction,
    env.APP_WEB_URL ?? LOCAL_ORIGIN
  ).replace(/\/$/, "");
  const expiresMinutes = Number(env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30);
  const mailFrom = requireString(
    env,
    "MAIL_FROM",
    isProduction,
    "Kaklen <no-reply@kaklen.local>"
  );
  const mailHost = requireString(env, "MAIL_HOST", isProduction, "localhost");
  const mailPort = Number(env.MAIL_PORT ?? env.MAILPIT_SMTP_PORT ?? 1025);
  const mailSecure = parseBoolean(env.MAIL_SECURE, false);
  const mailUser = optionalString(env.MAIL_USER);
  const mailPassword = optionalString(env.MAIL_PASSWORD);

  if (!Number.isInteger(expiresMinutes) || expiresMinutes <= 0 || expiresMinutes > 1440) {
    throw new Error("PASSWORD_RESET_EXPIRES_MINUTES must be an integer between 1 and 1440");
  }
  if (!Number.isInteger(mailPort) || mailPort <= 0 || mailPort > 65535) {
    throw new Error("MAIL_PORT must be a valid TCP port");
  }
  if (Boolean(mailUser) !== Boolean(mailPassword)) {
    throw new Error("MAIL_USER and MAIL_PASSWORD must be configured together");
  }

  const publicUrl = new URL(appPublicUrl);
  if (!["http:", "https:"].includes(publicUrl.protocol)) {
    throw new Error("APP_PUBLIC_URL must use http or https");
  }

  return {
    appPublicUrl,
    expiresMinutes,
    mailFrom,
    mailHost,
    mailPort,
    mailSecure,
    ...(mailUser ? { mailUser } : {}),
    ...(mailPassword ? { mailPassword } : {})
  };
}

function parseNodeEnv(value: string | undefined): ApiConfig["nodeEnv"] {
  if (value === "production" || value === "test" || value === "development") {
    return value;
  }
  return "development";
}

function parseLogLevel(value: string): ApiConfig["logLevel"] {
  if (value === "debug" || value === "info" || value === "warn" || value === "error") {
    return value;
  }
  throw new Error("LOG_LEVEL must be debug, info, warn, or error");
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return ["1", "true", "yes"].includes(value.toLowerCase());
}

function parseList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function requireString(
  env: Record<string, string | undefined>,
  key: string,
  required: boolean,
  fallback: string
): string {
  const value = optionalString(env[key]);
  if (!value && required) {
    throw new Error(`${key} is required in production`);
  }
  return value ?? fallback;
}

function optionalString(value: string | undefined): string | undefined {
  const cleaned = value?.trim();
  return cleaned ? cleaned : undefined;
}

export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const jwtAccessSecret =
    env.JWT_ACCESS_SECRET ?? "local-access-secret-change-me-at-least-32-characters";
  const jwtRefreshSecret =
    env.JWT_REFRESH_SECRET ?? "local-refresh-secret-change-me-at-least-32-characters";
  const jwtAccessExpiresSeconds = Number(env.JWT_ACCESS_EXPIRES_SECONDS ?? 900);
  const jwtRefreshExpiresSeconds = Number(env.JWT_REFRESH_EXPIRES_SECONDS ?? 604800);
  const cookieSecure = (env.COOKIE_SECURE ?? "false").toLowerCase() === "true";
  const authAllowedOrigins = (env.AUTH_ALLOWED_ORIGINS ?? "http://localhost:4200")
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  if (jwtAccessSecret.length < 32) {
    throw new Error("JWT_ACCESS_SECRET must be at least 32 characters");
  }

  if (jwtRefreshSecret.length < 32) {
    throw new Error("JWT_REFRESH_SECRET must be at least 32 characters");
  }

  if (!Number.isInteger(jwtAccessExpiresSeconds) || jwtAccessExpiresSeconds <= 0) {
    throw new Error("JWT_ACCESS_EXPIRES_SECONDS must be a positive integer");
  }

  if (!Number.isInteger(jwtRefreshExpiresSeconds) || jwtRefreshExpiresSeconds <= 0) {
    throw new Error("JWT_REFRESH_EXPIRES_SECONDS must be a positive integer");
  }

  return {
    jwtAccessSecret,
    jwtRefreshSecret,
    jwtAccessExpiresSeconds,
    jwtRefreshExpiresSeconds,
    cookieSecure,
    authAllowedOrigins
  };
}
