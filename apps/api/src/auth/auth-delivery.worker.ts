import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Worker } from "bullmq";
import { RedisService } from "../redis/redis.service";
import { AuthDeliveryProcessor } from "./auth-delivery.processor";
import {
  AUTH_DELIVERY_QUEUE,
  type AuthDeliveryJobData,
  type AuthDeliveryJobName
} from "./auth-delivery.types";

@Injectable()
export class AuthDeliveryWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AuthDeliveryWorker.name);
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
    this.worker.on("error", (error: Error) => {
      this.logger.error(
        JSON.stringify({ event: "auth_delivery_worker_error", error: error.name })
      );
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
