export interface ApiConfig {
  port: number;
  databaseUrl: string;
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

export function readApiConfig(env: Record<string, string | undefined>): ApiConfig {
  const port = Number(env.API_PORT ?? 3000);
  const databaseUrl =
    env.DATABASE_URL ?? "postgresql://kaklen:kaklen@localhost:5432/kaklen?schema=public";

  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("API_PORT must be a positive integer");
  }

  return {
    port,
    databaseUrl
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
