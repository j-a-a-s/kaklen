import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { ERROR_CODES } from "../common/error-codes";

interface RateLimitBucket {
  attempts: number;
  resetAt: number;
}

const FORGOT_WINDOW_MS = 15 * 60 * 1000;
const RESET_WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class PasswordRecoveryRateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  allowForgot(email: string, ipAddress: string): boolean {
    const ipAllowed = this.consume(`forgot:ip:${this.digest(ipAddress)}`, 10, FORGOT_WINDOW_MS);
    const emailAllowed = this.consume(`forgot:email:${this.digest(email)}`, 3, FORGOT_WINDOW_MS);
    return ipAllowed && emailAllowed;
  }

  assertResetAllowed(token: string, ipAddress: string): void {
    const ipAllowed = this.consume(`reset:ip:${this.digest(ipAddress)}`, 10, RESET_WINDOW_MS);
    const tokenAllowed = this.consume(`reset:token:${this.digest(token)}`, 5, RESET_WINDOW_MS);
    if (!ipAllowed || !tokenAllowed) {
      throw new HttpException(
        {
          code: ERROR_CODES.tooManyRequests,
          message: "Too many password reset attempts"
        },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private consume(key: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    this.pruneExpired(now);
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { attempts: 1, resetAt: now + windowMs });
      return true;
    }

    bucket.attempts += 1;
    return bucket.attempts <= limit;
  }

  private pruneExpired(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }

  private digest(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }
}
