import {
  coerceBoolean,
  coerceInteger,
  coerceStringList,
  normalizeOptionalString
} from "@kokecore/config";

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
  swaggerEnabled: boolean;
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

export interface MarketingConfig {
  leadNotificationEmail: string;
  siteUrl: string;
}

export interface PasswordRecoveryConfig {
  appPublicUrl: string;
  expiresMinutes: number;
  emailVerificationExpiresMinutes: number;
  mailFrom: string;
  mailHost: string;
  mailPort: number;
  mailSecure: boolean;
  mailConnectionTimeoutMs: number;
  mailGreetingTimeoutMs: number;
  mailSocketTimeoutMs: number;
  authEmailEnabled: boolean;
  commercialEmailEnabled: boolean;
  mailUser?: string;
  mailPassword?: string;
}

export interface ProductIntegrationsConfig {
  whatsappMode: "manual" | "provider";
  whatsappHashSecret: string;
  paymentGateway: "disabled" | "sandbox" | "provider";
  paymentSandboxSecret: string;
}

export interface RedisConfig {
  url: string;
  rateLimitHashSecret: string;
  rateLimitPrefix: string;
  authDeliveryPrefix: string;
}

export interface RuntimeEnvironmentConfig {
  api: ApiConfig;
  auth: AuthConfig;
  organization: OrganizationConfig;
  passwordRecovery: PasswordRecoveryConfig;
  productIntegrations: ProductIntegrationsConfig;
  redis: RedisConfig;
  marketing: MarketingConfig;
}

const LOCAL_DATABASE_URL = "postgresql://kaklen:kaklen_dev_password@localhost:5432/kaklen_dev?schema=public";
const LOCAL_ORIGIN = "http://localhost:4200";

export function readApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const port = Number(env.PORT ?? env.API_PORT ?? 3000);
  const databaseUrl = requireString(env, "DATABASE_URL", isProduction, LOCAL_DATABASE_URL);
  const databaseSsl = parseStrictBoolean(env.DATABASE_SSL, false, "DATABASE_SSL");
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
  if (isProduction) {
    assertProductionDatabaseTls(databaseUrl);
  }

  if (corsAllowedOrigins.length === 0) {
    throw new Error("CORS_ALLOWED_ORIGINS must include at least one origin");
  }
  if (isProduction) {
    assertProductionOrigins("CORS_ALLOWED_ORIGINS", corsAllowedOrigins);
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
    trustProxy: parseBoolean(env.TRUST_PROXY, false),
    swaggerEnabled: isProduction
      ? false
      : parseStrictBoolean(env.SWAGGER_ENABLED, true, "SWAGGER_ENABLED")
  };
}

export function readOrganizationConfig(env: Record<string, string | undefined>): OrganizationConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === "production";
  const organizationInvitationExpiresSeconds = Number(
    env.ORGANIZATION_INVITATION_EXPIRES_SECONDS ?? 259200
  );
  const appWebUrl = requireString(env, "APP_WEB_URL", isProduction, LOCAL_ORIGIN);

  if (
    !Number.isInteger(organizationInvitationExpiresSeconds) ||
    organizationInvitationExpiresSeconds <= 0
  ) {
    throw new Error("ORGANIZATION_INVITATION_EXPIRES_SECONDS must be a positive integer");
  }
  if (isProduction) {
    assertProductionOrigin("APP_WEB_URL", appWebUrl);
  }

  return {
    organizationInvitationExpiresSeconds,
    appWebUrl
  };
}

export function readMarketingConfig(env: Record<string, string | undefined>): MarketingConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === "production";
  const leadNotificationEmail = requireString(
    env,
    "LEAD_NOTIFICATION_EMAIL",
    isProduction,
    "leads@kaklen.local"
  );
  const siteUrl = requireString(env, "MARKETING_SITE_URL", isProduction, "http://localhost:4300");

  const parsedSiteUrl = new URL(siteUrl);
  if (!["http:", "https:"].includes(parsedSiteUrl.protocol)) {
    throw new Error("MARKETING_SITE_URL must use http or https");
  }
  if (parsedSiteUrl.username || parsedSiteUrl.password) {
    throw new Error("MARKETING_SITE_URL must not contain embedded credentials");
  }
  if (parsedSiteUrl.pathname !== "/" || parsedSiteUrl.search || parsedSiteUrl.hash) {
    throw new Error("MARKETING_SITE_URL must be an origin without path, query, or fragment");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(leadNotificationEmail)) {
    throw new Error("LEAD_NOTIFICATION_EMAIL must be a valid email address");
  }
  if (isProduction) {
    assertProductionOrigin("MARKETING_SITE_URL", parsedSiteUrl.toString());
  }

  return {
    leadNotificationEmail,
    siteUrl: parsedSiteUrl.origin
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
  );
  const expiresMinutes = Number(env.PASSWORD_RESET_EXPIRES_MINUTES ?? 30);
  const emailVerificationExpiresMinutes = Number(
    env.EMAIL_VERIFICATION_EXPIRES_MINUTES ?? 1440
  );
  const mailFrom = requireString(
    env,
    "MAIL_FROM",
    isProduction,
    "Kaklen <no-reply@kaklen.local>"
  );
  const mailHost = requireString(env, "MAIL_HOST", isProduction, "localhost");
  const mailPort = Number(env.MAIL_PORT ?? env.MAILPIT_SMTP_PORT ?? 1025);
  const mailSecure = parseStrictBoolean(env.MAIL_SECURE, false, "MAIL_SECURE");
  const mailConnectionTimeoutMs = parseTimeout(
    env.MAIL_CONNECTION_TIMEOUT_MS,
    5000,
    "MAIL_CONNECTION_TIMEOUT_MS"
  );
  const mailGreetingTimeoutMs = parseTimeout(
    env.MAIL_GREETING_TIMEOUT_MS,
    5000,
    "MAIL_GREETING_TIMEOUT_MS"
  );
  const mailSocketTimeoutMs = parseTimeout(
    env.MAIL_SOCKET_TIMEOUT_MS,
    10000,
    "MAIL_SOCKET_TIMEOUT_MS"
  );
  const mailUser = optionalString(env.MAIL_USER);
  const mailPassword = optionalString(env.MAIL_PASSWORD);
  const authEmailEnabled = parseStrictBoolean(
    env.AUTH_EMAIL_ENABLED,
    true,
    "AUTH_EMAIL_ENABLED"
  );
  const commercialEmailEnabled = parseStrictBoolean(
    env.COMMERCIAL_EMAIL_ENABLED,
    false,
    "COMMERCIAL_EMAIL_ENABLED"
  );

  if (!Number.isInteger(expiresMinutes) || expiresMinutes <= 0 || expiresMinutes > 1440) {
    throw new Error("PASSWORD_RESET_EXPIRES_MINUTES must be an integer between 1 and 1440");
  }
  if (
    !Number.isInteger(emailVerificationExpiresMinutes) ||
    emailVerificationExpiresMinutes <= 0 ||
    emailVerificationExpiresMinutes > 10080
  ) {
    throw new Error(
      "EMAIL_VERIFICATION_EXPIRES_MINUTES must be an integer between 1 and 10080"
    );
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
  if (publicUrl.search || publicUrl.hash) {
    throw new Error("APP_PUBLIC_URL must not include query parameters or a fragment");
  }
  if (publicUrl.pathname !== "/") {
    throw new Error("APP_PUBLIC_URL must be an origin without a path");
  }
  if (isProduction) {
    assertProductionOrigin("APP_PUBLIC_URL", publicUrl.toString());
  }

  return {
    appPublicUrl: publicUrl.origin,
    expiresMinutes,
    emailVerificationExpiresMinutes,
    mailFrom,
    mailHost,
    mailPort,
    mailSecure,
    mailConnectionTimeoutMs,
    mailGreetingTimeoutMs,
    mailSocketTimeoutMs,
    authEmailEnabled,
    commercialEmailEnabled,
    ...(mailUser ? { mailUser } : {}),
    ...(mailPassword ? { mailPassword } : {})
  };
}

export function readProductIntegrationsConfig(
  env: Record<string, string | undefined>
): ProductIntegrationsConfig {
  const nodeEnv = parseNodeEnv(env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const whatsappMode = env.WHATSAPP_MODE ?? "manual";
  // No production default of "sandbox": until a real adapter is registered,
  // production must run with payments disabled rather than silently exposing
  // the sandbox lifecycle. Non-production keeps defaulting to sandbox so
  // local/dev/test workflows are unaffected.
  const paymentGateway = env.PAYMENT_GATEWAY ?? (isProduction ? "disabled" : "sandbox");
  const whatsappHashSecret = requireString(
    env,
    "WHATSAPP_HASH_SECRET",
    isProduction,
    "local-whatsapp-hash-secret-change-me"
  );
  const paymentSandboxSecret = requireString(
    env,
    "PAYMENT_SANDBOX_SECRET",
    isProduction,
    "local-payment-sandbox-secret-change-me"
  );

  if (whatsappMode !== "manual" && whatsappMode !== "provider") {
    throw new Error("WHATSAPP_MODE must be manual or provider");
  }
  if (paymentGateway !== "disabled" && paymentGateway !== "sandbox" && paymentGateway !== "provider") {
    throw new Error("PAYMENT_GATEWAY must be disabled, sandbox, or provider");
  }
  // Sandbox is a development/test convenience — it must never be reachable
  // in production, regardless of what an operator sets explicitly.
  if (isProduction && paymentGateway === "sandbox") {
    throw new Error("PAYMENT_GATEWAY must not be sandbox in production");
  }
  if (whatsappHashSecret.length < 32) {
    throw new Error("WHATSAPP_HASH_SECRET must be at least 32 characters");
  }
  if (paymentSandboxSecret.length < 32) {
    throw new Error("PAYMENT_SANDBOX_SECRET must be at least 32 characters");
  }
  if (isProduction) {
    assertCryptographicSecret("WHATSAPP_HASH_SECRET", whatsappHashSecret);
    assertCryptographicSecret("PAYMENT_SANDBOX_SECRET", paymentSandboxSecret);
  }

  return {
    whatsappMode,
    whatsappHashSecret,
    paymentGateway,
    paymentSandboxSecret
  };
}

export function readRedisConfig(env: Record<string, string | undefined>): RedisConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === "production";
  const redisPort = Number(env.REDIS_PORT ?? 6379);
  if (!Number.isInteger(redisPort) || redisPort <= 0 || redisPort > 65535) {
    throw new Error("REDIS_PORT must be a valid TCP port");
  }

  const url = requireString(
    env,
    "REDIS_URL",
    isProduction,
    `redis://localhost:${redisPort}`
  );
  const rateLimitHashSecret = requireString(
    env,
    "RATE_LIMIT_HASH_SECRET",
    isProduction,
    "local-rate-limit-hash-secret-change-me"
  );

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("REDIS_URL must be a valid Redis URL");
  }
  if (parsedUrl.protocol !== "redis:" && parsedUrl.protocol !== "rediss:") {
    throw new Error("REDIS_URL must use redis or rediss");
  }
  if (isProduction) {
    if (parsedUrl.protocol !== "rediss:") {
      throw new Error("REDIS_URL must use rediss in production");
    }
    if (isForbiddenProductionRedisHost(parsedUrl.hostname)) {
      throw new Error("REDIS_URL must not target localhost or loopback in production");
    }
    assertCryptographicSecret("RATE_LIMIT_HASH_SECRET", rateLimitHashSecret);
  }

  return {
    url: parsedUrl.toString(),
    rateLimitHashSecret,
    rateLimitPrefix: "kaklen:rate-limit",
    authDeliveryPrefix: "kaklen:auth-delivery"
  };
}

function isForbiddenProductionRedisHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0.0.0.0"
  ) {
    return true;
  }

  const ipv4Parts = normalized.split(".");
  return (
    ipv4Parts.length === 4 &&
    ipv4Parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255) &&
    Number(ipv4Parts[0]) === 127
  );
}

export function validateRuntimeEnvironment(
  env: Record<string, string | undefined>
): RuntimeEnvironmentConfig {
  const api = readApiConfig(env);
  const auth = readAuthConfig(env);
  const organization = readOrganizationConfig(env);
  const passwordRecovery = readPasswordRecoveryConfig(env);
  const productIntegrations = readProductIntegrationsConfig(env);
  const redis = readRedisConfig(env);
  const marketing = readMarketingConfig(env);

  return { api, auth, organization, passwordRecovery, productIntegrations, redis, marketing };
}

function parseTimeout(value: string | undefined, fallback: number, key: string): number {
  return coerceInteger(value, {
    key,
    defaultValue: fallback,
    minimum: 100,
    maximum: 120000
  });
}

function parseStrictBoolean(
  value: string | undefined,
  fallback: boolean,
  key: string
): boolean {
  return coerceBoolean(value, {
    key,
    defaultValue: fallback,
    trueValues: ["1", "true", "yes"],
    falseValues: ["0", "false", "no"]
  });
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
  return coerceStringList(value);
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
  return normalizeOptionalString(value);
}

export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig {
  const isProduction = parseNodeEnv(env.NODE_ENV) === "production";
  const jwtAccessSecret = requireString(
    env,
    "JWT_ACCESS_SECRET",
    isProduction,
    "local-access-secret-change-me-at-least-32-characters"
  );
  const jwtRefreshSecret = requireString(
    env,
    "JWT_REFRESH_SECRET",
    isProduction,
    "local-refresh-secret-change-me-at-least-32-characters"
  );
  const jwtAccessExpiresSeconds = Number(env.JWT_ACCESS_EXPIRES_SECONDS ?? 900);
  const jwtRefreshExpiresSeconds = Number(env.JWT_REFRESH_EXPIRES_SECONDS ?? 604800);
  const cookieSecure = parseStrictBoolean(env.COOKIE_SECURE, false, "COOKIE_SECURE");
  const authAllowedOrigins = parseList(
    requireString(env, "AUTH_ALLOWED_ORIGINS", isProduction, LOCAL_ORIGIN)
  );

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
  if (isProduction) {
    assertCryptographicSecret("JWT_ACCESS_SECRET", jwtAccessSecret);
    assertCryptographicSecret("JWT_REFRESH_SECRET", jwtRefreshSecret);
    if (jwtAccessSecret.toLowerCase() === jwtRefreshSecret.toLowerCase()) {
      throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
    }
    if (!cookieSecure) {
      throw new Error("COOKIE_SECURE must be true in production");
    }
    assertProductionOrigins("AUTH_ALLOWED_ORIGINS", authAllowedOrigins);
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

const FORBIDDEN_SECRET_FRAGMENTS = [
  "change-me",
  "local-",
  "example",
  "default",
  "secret-at-least"
];

function assertCryptographicSecret(key: string, value: string): void {
  const normalized = value.toLowerCase();
  if (FORBIDDEN_SECRET_FRAGMENTS.some((fragment) => normalized.includes(fragment))) {
    throw new Error(`${key} contains a forbidden placeholder`);
  }
  if (!/^[0-9a-f]{64,}$/i.test(value)) {
    throw new Error(`${key} must be hexadecimal with at least 64 characters`);
  }
  if (new Set(normalized).size < 8 || isRepeatedPattern(normalized)) {
    throw new Error(`${key} must not use repeated or low-diversity content`);
  }
}

function isRepeatedPattern(value: string): boolean {
  for (
    let patternLength = 1;
    patternLength <= Math.floor(value.length / 2);
    patternLength += 1
  ) {
    if (value.length % patternLength !== 0) {
      continue;
    }
    const pattern = value.slice(0, patternLength);
    if (pattern.repeat(value.length / patternLength) === value) {
      return true;
    }
  }
  return false;
}

function assertProductionOrigins(key: string, values: string[]): void {
  if (values.length === 0) {
    throw new Error(`${key} must include at least one origin`);
  }
  values.forEach((value) => assertProductionOrigin(key, value));
}

function assertProductionDatabaseTls(value: string): void {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(value);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("DATABASE_URL must use postgres or postgresql");
  }
  if (databaseUrl.searchParams.get("sslmode") !== "require") {
    throw new Error("DATABASE_URL must include sslmode=require in production");
  }
}

function assertProductionOrigin(key: string, value: string): void {
  const normalized = value.trim();
  if (normalized.includes("*") || normalized.toLowerCase() === "null") {
    throw new Error(`${key} must not contain wildcard or null origins`);
  }

  let origin: URL;
  try {
    origin = new URL(normalized);
  } catch {
    throw new Error(`${key} must contain valid origins`);
  }
  if (origin.protocol !== "https:") {
    throw new Error(`${key} must use https in production`);
  }
  if (origin.username || origin.password) {
    throw new Error(`${key} must not contain embedded credentials`);
  }
  if (origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error(`${key} must contain origins without path, query, or fragment`);
  }
  if (isLocalOrLoopbackHost(origin.hostname)) {
    throw new Error(`${key} must not contain localhost or loopback addresses`);
  }
}

function isLocalOrLoopbackHost(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0:0:0:0:0:0:0:1" ||
    /^::ffff:7f[0-9a-f]{2}:/.test(normalized) ||
    normalized === "0.0.0.0" ||
    /^127(?:\.\d{1,3}){3}$/.test(normalized)
  );
}
