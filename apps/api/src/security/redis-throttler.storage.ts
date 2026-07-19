import { Injectable } from "@nestjs/common";
import type { ThrottlerStorage } from "@nestjs/throttler";
import { DistributedRateLimitService } from "./distributed-rate-limit.service";

@Injectable()
export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly rateLimits: DistributedRateLimitService) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    _blockDuration: number,
    throttlerName: string
  ): Promise<{
    totalHits: number;
    timeToExpire: number;
    isBlocked: boolean;
    timeToBlockExpire: number;
  }> {
    const result = await this.rateLimits.consume(
      `throttler:${throttlerName}`,
      [key],
      limit,
      ttl
    );
    return {
      totalHits: result.count,
      timeToExpire: result.retryAfterSeconds,
      isBlocked: !result.allowed,
      timeToBlockExpire: result.retryAfterSeconds
    };
  }
}
