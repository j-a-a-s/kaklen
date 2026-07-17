export interface HealthResponse {
  status: "ok" | "error";
  service: string;
  version: string;
  commitSha: string;
  buildTime: string;
  environment: string;
  timestamp: string;
  checks: {
    database: "ok" | "error" | "unknown";
    redis?: "ok" | "error" | "not_configured";
  };
}

export const KAKLEN_API_PREFIX = "api";

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface MessageResponse {
  message: string;
}

export const PASSWORD_MIN_LENGTH = 10;

export const VALIDATION_LIMITS = {
  email: 254,
  phone: 40,
  shortName: 80,
  name: 160,
  code: 80,
  unit: 40,
  address: 240,
  note: 2_000,
  statusNote: 500,
  emailSubject: 200,
  emailMessage: 5_000
} as const;

export type PasswordStrength = "weak" | "acceptable" | "strong";

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return "weak";
  }

  const characterGroups = [
    /[a-z]/.test(password),
    /[A-Z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ].filter(Boolean).length;

  if (password.length >= 14 && characterGroups >= 3) {
    return "strong";
  }

  return characterGroups >= 2 ? "acceptable" : "weak";
}

export type OrganizationRole = "OWNER" | "ADMIN" | "MANAGER" | "MEMBER" | "VIEWER";
export type OrganizationStatus = "ACTIVE" | "SUSPENDED" | "DELETED";
export type OrganizationMembershipStatus = "ACTIVE" | "INVITED" | "SUSPENDED";

export interface OrganizationSummary {
  id: string;
  name: string;
  slug: string;
  legalName: string | null;
  taxId: string | null;
  country: string;
  currency: string;
  timezone: string;
  dateFormat: string;
  numberFormat: string;
  defaultLocale: string;
  status: OrganizationStatus;
  role: OrganizationRole;
  createdAt: string;
  updatedAt: string;
}

export interface OrganizationMember {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: OrganizationRole;
  status: OrganizationMembershipStatus;
  joinedAt: string;
}

export * from "./quotation-money.js";
export * from "./country-business-policy.js";
