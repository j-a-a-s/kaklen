import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { RateLimitExceededException } from "../common/rate-limit-exceptions";
import {
  DistributedRateLimitService,
  type RateLimitResult
} from "../security/distributed-rate-limit.service";
import type { AuthRequestContext } from "./auth.types";

const ONE_MINUTE_MS = 60_000;
const FIFTEEN_MINUTES_MS = 15 * ONE_MINUTE_MS;

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly rateLimits: DistributedRateLimitService) {}

  async assertRegisterAllowed(context: AuthRequestContext): Promise<void> {
    this.assertAllowed(
      [await this.consume("register:ip", context.ipAddress, 3, ONE_MINUTE_MS)],
      "Too many registration attempts"
    );
  }

  async assertLoginAllowed(email: string, context: AuthRequestContext): Promise<void> {
    const results = await Promise.all([
      this.consume("login:ip", context.ipAddress, 5, ONE_MINUTE_MS),
      this.consume("login:email", this.normalizeEmail(email), 5, ONE_MINUTE_MS)
    ]);
    this.assertAllowed(results, "Too many login attempts");
  }

  async allowForgotPassword(email: string, context: AuthRequestContext): Promise<boolean> {
    const results = await Promise.all([
      this.consume("forgot-password:ip", context.ipAddress, 10, FIFTEEN_MINUTES_MS),
      this.consume("forgot-password:email", this.normalizeEmail(email), 3, FIFTEEN_MINUTES_MS)
    ]);
    return results.every((result) => result.allowed);
  }

  async assertResetPasswordAllowed(
    token: string,
    context: AuthRequestContext
  ): Promise<void> {
    const results = await Promise.all([
      this.consume("reset-password:ip", context.ipAddress, 10, FIFTEEN_MINUTES_MS),
      this.consume("reset-password:token", this.tokenDigest(token), 5, FIFTEEN_MINUTES_MS)
    ]);
    this.assertAllowed(results, "Too many password reset attempts");
  }

  async allowVerificationResend(email: string, context: AuthRequestContext): Promise<boolean> {
    const results = await Promise.all([
      this.consume("resend-verification:ip", context.ipAddress, 3, ONE_MINUTE_MS),
      this.consume(
        "resend-verification:email",
        this.normalizeEmail(email),
        3,
        FIFTEEN_MINUTES_MS
      )
    ]);
    return results.every((result) => result.allowed);
  }

  async assertEmailVerificationAllowed(
    token: string,
    context: AuthRequestContext
  ): Promise<void> {
    const results = await Promise.all([
      this.consume("verify-email:ip", context.ipAddress, 10, ONE_MINUTE_MS),
      this.consume("verify-email:token", this.tokenDigest(token), 10, ONE_MINUTE_MS)
    ]);
    this.assertAllowed(results, "Too many email verification attempts");
  }

  private consume(
    purpose: string,
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    return this.rateLimits.consume(purpose, [identifier], limit, windowMs);
  }

  private assertAllowed(results: readonly RateLimitResult[], message: string): void {
    const denied = results.filter((result) => !result.allowed);
    if (denied.length === 0) {
      return;
    }
    throw new RateLimitExceededException(
      Math.max(...denied.map((result) => result.retryAfterSeconds)),
      message
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private tokenDigest(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
