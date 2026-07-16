import type { Request } from "express";

export interface JwtAccessPayload {
  sub: string;
  email: string;
  sessionVersion: number;
}

export interface PasswordRecoveryRequestContext {
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
}

export type CookieRequest = Request & {
  cookies: Record<string, string | undefined>;
};
