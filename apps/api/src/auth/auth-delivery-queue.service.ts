import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { AuthDeliveryUnavailableException } from "../common/rate-limit-exceptions";
import { RedisService } from "../redis/redis.service";
import { DistributedRateLimitService } from "../security/distributed-rate-limit.service";
import type { AuthRequestContext } from "./auth.types";
import {
  AUTH_DELIVERY_QUEUE,
  type AuthDeliveryJobData,
  type AuthDeliveryJobName
} from "./auth-delivery.types";

@Injectable()
export class AuthDeliveryQueueService implements OnModuleDestroy {
  private readonly queue: Queue<AuthDeliveryJobData, void, AuthDeliveryJobName>;

  constructor(
    redis: RedisService,
    private readonly rateLimits: DistributedRateLimitService
  ) {
    this.queue = new Queue<AuthDeliveryJobData, void, AuthDeliveryJobName>(AUTH_DELIVERY_QUEUE, {
      connection: redis.client,
      prefix: redis.config.authDeliveryPrefix,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 500 },
        removeOnComplete: { age: 3600, count: 1000 },
        removeOnFail: { age: 86400, count: 100 }
      }
    });
    this.queue.on("error", () => undefined);
  }

  enqueuePasswordReset(email: string, context: AuthRequestContext): Promise<void> {
    return this.enqueue("password-reset", email, context);
  }

  enqueueVerificationResend(email: string, context: AuthRequestContext): Promise<void> {
    return this.enqueue("verification-resend", email, context);
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }

  private async enqueue(
    name: AuthDeliveryJobName,
    email: string,
    context: AuthRequestContext
  ): Promise<void> {
    const data: AuthDeliveryJobData = {
      email: email.trim().toLowerCase(),
      ipHash: this.rateLimits.hashSensitive(context.ipAddress),
      ...(context.userAgent
        ? { userAgentHash: this.rateLimits.hashSensitive(context.userAgent) }
        : {}),
      ...(context.requestId ? { requestId: context.requestId } : {})
    };
    try {
      await this.queue.add(name, data);
    } catch {
      throw new AuthDeliveryUnavailableException();
    }
  }
}
