import type { EventEmitter } from "node:events";
import { SafeOperationalLogger } from "./safe-operational-logger";

interface RedisEventSource extends EventEmitter {
  readonly status: string;
}

export function observeRedis(
  redis: RedisEventSource,
  logger: SafeOperationalLogger
): void {
  redis.on("error", (error: unknown) => {
    logger.write("error", "error", { error, state: redis.status });
  });
  redis.on("reconnecting", () => {
    logger.write("warn", "reconnecting", { state: "reconnecting" });
  });
  redis.on("ready", () => {
    logger.write("log", "ready", { state: "ready" });
  });
  redis.on("close", () => {
    logger.write("warn", "close", { state: "closed" });
  });
}

export function observeQueue(queue: EventEmitter, logger: SafeOperationalLogger): void {
  queue.on("error", (error: unknown) => {
    logger.write("error", "error", { error, state: "error" });
  });
  queue.on("waiting", () => {
    logger.write("log", "waiting", { state: "waiting" });
  });
}

export function observeWorker(worker: EventEmitter, logger: SafeOperationalLogger): void {
  worker.on("error", (error: unknown) => {
    logger.write("error", "error", { error, state: "error" });
  });
  worker.on("failed", (_job: unknown, error: unknown) => {
    logger.write("error", "failed", { error, state: "failed" });
  });
  worker.on("stalled", () => {
    logger.write("warn", "stalled", { state: "stalled" });
  });
  worker.on("ready", () => {
    logger.write("log", "ready", { state: "ready" });
  });
  worker.on("closed", () => {
    logger.write("warn", "closed", { state: "closed" });
  });
}
