import { Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";

interface RateWindow {
  count: number;
  expiresAt: number;
}

const RESEND_WINDOW_MS = 15 * 60 * 1000;
const RESEND_LIMIT = 3;

@Injectable()
export class EmailVerificationRateLimitService {
  private readonly attempts = new Map<string, RateWindow>();

  allowResend(email: string, now = Date.now()): boolean {
    const key = createHash("sha256").update(email).digest("hex");
    const current = this.attempts.get(key);
    if (!current || current.expiresAt <= now) {
      this.attempts.set(key, { count: 1, expiresAt: now + RESEND_WINDOW_MS });
      return true;
    }
    if (current.count >= RESEND_LIMIT) {
      return false;
    }
    current.count += 1;
    return true;
  }
}
