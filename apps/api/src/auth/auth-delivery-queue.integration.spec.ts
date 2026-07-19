import { Queue, QueueEvents, Worker } from "bullmq";
import { RedisService } from "../redis/redis.service";
import { DistributedRateLimitService } from "../security/distributed-rate-limit.service";
import { AuthDeliveryQueueService } from "./auth-delivery-queue.service";
import {
  AUTH_DELIVERY_QUEUE,
  type AuthDeliveryJobData,
  type AuthDeliveryJobName
} from "./auth-delivery.types";

describe("authentication delivery queue with Redis", () => {
  let redis: RedisService;
  let deliveryQueue: AuthDeliveryQueueService;
  let inspectionQueue: Queue<AuthDeliveryJobData, void, AuthDeliveryJobName>;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = "redis://localhost:6379/14";
    process.env.RATE_LIMIT_HASH_SECRET = "auth-delivery-integration-secret";
    redis = new RedisService();
    const rateLimits = new DistributedRateLimitService(redis);
    deliveryQueue = new AuthDeliveryQueueService(redis, rateLimits);
    inspectionQueue = new Queue<AuthDeliveryJobData, void, AuthDeliveryJobName>(
      AUTH_DELIVERY_QUEUE,
      { connection: redis.client, prefix: redis.config.authDeliveryPrefix }
    );
    inspectionQueue.on("error", () => undefined);
    await redis.ping();
  });

  beforeEach(async () => {
    await inspectionQueue.obliterate({ force: true });
  });

  afterAll(async () => {
    await inspectionQueue.obliterate({ force: true });
    await Promise.all([inspectionQueue.close(), deliveryQueue.onModuleDestroy()]);
    await redis.close();
  });

  it("uses a reconnecting connection without command timeouts for blocking workers", () => {
    const options = redis.workerOptions();

    expect(options.commandTimeout).toBeUndefined();
    expect(options.maxRetriesPerRequest).toBeNull();
    expect(options.retryStrategy?.(1)).toBeGreaterThan(0);
  });

  it("enqueues the same safe job type for existing and missing account inputs", async () => {
    const context = {
      ipAddress: "203.0.113.20",
      userAgent: "Integration Browser",
      requestId: "request-1"
    };

    await deliveryQueue.enqueuePasswordReset("existing@example.com", context);
    await deliveryQueue.enqueuePasswordReset("missing@example.com", context);

    const jobs = await inspectionQueue.getJobs(["waiting", "delayed"]);
    expect(jobs).toHaveLength(2);
    expect(jobs.map((job) => job.name)).toEqual(["password-reset", "password-reset"]);
    expect(jobs.map((job) => job.data.email).sort()).toEqual([
      "existing@example.com",
      "missing@example.com"
    ]);
    expect(jobs[0]?.opts).toMatchObject({
      attempts: 3,
      backoff: { type: "exponential", delay: 500 }
    });
    for (const job of jobs) {
      const serialized = JSON.stringify(job.data);
      expect(serialized).not.toContain(context.ipAddress);
      expect(serialized).not.toContain(context.userAgent);
      expect(serialized).not.toMatch(/token|password|https?:\/\//i);
    }
  });

  it("allows two workers to claim a job only once", async () => {
    let processingCalls = 0;
    let activeCalls = 0;
    let maximumActiveCalls = 0;
    let releaseProcessing: (() => void) | undefined;
    let reportStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      reportStarted = resolve;
    });
    const release = new Promise<void>((resolve) => {
      releaseProcessing = resolve;
    });
    const processor = async (): Promise<void> => {
      processingCalls += 1;
      activeCalls += 1;
      maximumActiveCalls = Math.max(maximumActiveCalls, activeCalls);
      reportStarted?.();
      await release;
      activeCalls -= 1;
    };
    const workerA = new Worker<AuthDeliveryJobData, void, AuthDeliveryJobName>(
      AUTH_DELIVERY_QUEUE,
      processor,
      { connection: redis.workerOptions(), prefix: redis.config.authDeliveryPrefix }
    );
    const workerB = new Worker<AuthDeliveryJobData, void, AuthDeliveryJobName>(
      AUTH_DELIVERY_QUEUE,
      processor,
      { connection: redis.workerOptions(), prefix: redis.config.authDeliveryPrefix }
    );
    const events = new QueueEvents(AUTH_DELIVERY_QUEUE, {
      connection: redis.workerOptions(),
      prefix: redis.config.authDeliveryPrefix
    });
    workerA.on("error", () => undefined);
    workerB.on("error", () => undefined);
    events.on("error", () => undefined);
    await Promise.all([workerA.waitUntilReady(), workerB.waitUntilReady(), events.waitUntilReady()]);

    const job = await inspectionQueue.add("password-reset", {
      email: "worker@example.com",
      ipHash: "ip-hash"
    });
    await started;
    releaseProcessing?.();
    await job.waitUntilFinished(events, 3000);

    expect(processingCalls).toBe(1);
    expect(maximumActiveCalls).toBe(1);
    await Promise.all([workerA.close(), workerB.close(), events.close()]);
  });

  it("returns AUTH_DELIVERY_UNAVAILABLE when Redis cannot accept a job", async () => {
    const previousUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:6398";
    const unavailableRedis = new RedisService();
    const unavailableQueue = new AuthDeliveryQueueService(
      unavailableRedis,
      new DistributedRateLimitService(unavailableRedis)
    );

    await expect(
      unavailableQueue.enqueueVerificationResend("ada@example.com", {
        ipAddress: "203.0.113.30"
      })
    ).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: "AUTH_DELIVERY_UNAVAILABLE" })
    });

    await unavailableQueue.onModuleDestroy();
    await unavailableRedis.close();
    if (previousUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousUrl;
    }
  });
});
