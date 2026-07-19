import { Injectable, Logger, type OnModuleDestroy } from "@nestjs/common";
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
  private readonly logger = new Logger(AuthDeliveryQueueService.name);
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
        removeOnComplete: true,
        removeOnFail: true
      }
    });
    this.queue.on("error", (error: Error) => {
      this.logger.error(
        JSON.stringify({ event: "auth_delivery_queue_error", error: error.name })
      );
    });
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
    const normalizedEmail = email.trim().toLowerCase();
    const data: AuthDeliveryJobData = {
      email: normalizedEmail,
      ipHash: this.rateLimits.hashSensitive(context.ipAddress),
      ...(context.userAgent
        ? { userAgentHash: this.rateLimits.hashSensitive(context.userAgent) }
        : {}),
      ...(context.requestId
        ? { requestIdHash: this.rateLimits.hashSensitive(context.requestId) }
        : {})
    };
    try {
      await this.queue.add(name, data, {
        jobId: this.rateLimits.hashSensitive(`${name}\u0000${normalizedEmail}`)
      });
    } catch {
      throw new AuthDeliveryUnavailableException();
    }
  }
}
