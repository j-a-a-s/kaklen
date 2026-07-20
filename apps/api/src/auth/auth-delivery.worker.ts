import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { observeWorker } from "../common/infrastructure-observability";
import { SafeOperationalLogger } from "../common/safe-operational-logger";
import { RedisService } from "../redis/redis.service";
import { AuthDeliveryProcessor } from "./auth-delivery.processor";
import {
  AUTH_DELIVERY_QUEUE,
  type AuthDeliveryJobData,
  type AuthDeliveryJobName
} from "./auth-delivery.types";

@Injectable()
export class AuthDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly operationalLogger = new SafeOperationalLogger("auth-delivery-worker");
  private worker?: Worker<AuthDeliveryJobData, void, AuthDeliveryJobName>;

  constructor(
    private readonly redis: RedisService,
    private readonly processor: AuthDeliveryProcessor
  ) {}

  onModuleInit(): void {
    this.worker = new Worker<AuthDeliveryJobData, void, AuthDeliveryJobName>(
      AUTH_DELIVERY_QUEUE,
      (job) => this.processor.process(job),
      {
        connection: this.redis.workerOptions(),
        prefix: this.redis.config.authDeliveryPrefix,
        concurrency: 4
      }
    );
    observeWorker(this.worker, this.operationalLogger);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
