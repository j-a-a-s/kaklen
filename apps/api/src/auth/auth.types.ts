import type { Request } from "express";

export interface JwtAccessPayload {
  sub: string;
  email: string;
  sessionVersion: number;
}

export interface AuthRequestContext {
  ipAddress: string;
  userAgent?: string;
  requestId?: string;
}

export type PasswordRecoveryRequestContext = AuthRequestContext;

export interface AuthenticatedRequest extends Request {
  user: JwtAccessPayload;
}

export type CookieRequest = Request & {
  cookies: Record<string, string | undefined>;
};
