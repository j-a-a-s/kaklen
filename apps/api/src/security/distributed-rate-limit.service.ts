import { Injectable } from "@nestjs/common";
import { createHmac } from "node:crypto";
import { RedisService } from "../redis/redis.service";
import { RateLimitBackendUnavailableException } from "../common/rate-limit-exceptions";

export interface RateLimitResult {
  allowed: boolean;
  count: number;
  ttlMs: number;
  retryAfterSeconds: number;
}

const CONSUME_SCRIPT = `
local count = redis.call("INCR", KEYS[1])
if count == 1 then
  redis.call("PEXPIRE", KEYS[1], ARGV[1])
end
local ttl = redis.call("PTTL", KEYS[1])
return {count, ttl}
`;

@Injectable()
export class DistributedRateLimitService {
  constructor(private readonly redis: RedisService) {}

  async consume(
    purpose: string,
    identifiers: readonly string[],
    limit: number,
    windowMs: number
  ): Promise<RateLimitResult> {
    if (!Number.isInteger(limit) || limit <= 0 || !Number.isInteger(windowMs) || windowMs <= 0) {
      throw new Error("Rate limit and window must be positive integers");
    }

    const key = this.keyFor(purpose, identifiers);
    try {
      const raw = await this.redis.client.call("EVAL", [
        CONSUME_SCRIPT,
        1,
        key,
        String(windowMs)
      ]);
      const [count, ttlMs] = this.parseResult(raw);
      return {
        allowed: count <= limit,
        count,
        ttlMs,
        retryAfterSeconds: Math.max(1, Math.ceil(ttlMs / 1000))
      };
    } catch (error) {
      if (error instanceof RateLimitBackendUnavailableException) {
        throw error;
      }
      throw new RateLimitBackendUnavailableException();
    }
  }

  keyFor(purpose: string, identifiers: readonly string[]): string {
    const safePurpose = purpose.replace(/[^a-z0-9:_-]/gi, "-").toLowerCase();
    const digest = createHmac("sha256", this.redis.config.rateLimitHashSecret)
      .update(identifiers.join("\u0000"))
      .digest("hex");
    return `${this.redis.config.rateLimitPrefix}:${safePurpose}:${digest}`;
  }

  hashSensitive(value: string): string {
    return createHmac("sha256", this.redis.config.rateLimitHashSecret)
      .update(value)
      .digest("hex");
  }

  private parseResult(raw: unknown): [number, number] {
    if (!Array.isArray(raw) || raw.length !== 2) {
      throw new Error("Redis returned an invalid rate limit result");
    }
    const count = Number(raw[0]);
    const ttlMs = Number(raw[1]);
    if (!Number.isInteger(count) || count < 1 || !Number.isInteger(ttlMs) || ttlMs < 0) {
      throw new Error("Redis returned an invalid rate limit counter");
    }
    return [count, ttlMs];
  }
}
