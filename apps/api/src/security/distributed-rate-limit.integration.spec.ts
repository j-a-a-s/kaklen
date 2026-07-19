import { HttpStatus } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import { DistributedRateLimitService } from "./distributed-rate-limit.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

describe("DistributedRateLimitService with Redis", () => {
  let redisA: RedisService;
  let redisB: RedisService;
  let limiterA: DistributedRateLimitService;
  let limiterB: DistributedRateLimitService;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = "redis://localhost:6379/13";
    process.env.RATE_LIMIT_HASH_SECRET = "rate-limit-integration-secret";
    redisA = new RedisService();
    redisB = new RedisService();
    limiterA = new DistributedRateLimitService(redisA);
    limiterB = new DistributedRateLimitService(redisB);
    await Promise.all([redisA.ping(), redisB.ping()]);
    await clearIntegrationKeys(redisA);
  });

  afterAll(async () => {
    await clearIntegrationKeys(redisA);
    await Promise.all([redisA.close(), redisB.close()]);
  });

  it("shares counters between application instances", async () => {
    const first = await limiterA.consume("test:shared", ["203.0.113.10"], 2, 5000);
    const second = await limiterB.consume("test:shared", ["203.0.113.10"], 2, 5000);
    const third = await limiterA.consume("test:shared", ["203.0.113.10"], 2, 5000);

    expect([first.count, second.count, third.count]).toEqual([1, 2, 3]);
    expect(third.allowed).toBe(false);
  });

  it("backs Nest throttler storage with the same distributed counter", async () => {
    const storageA = new RedisThrottlerStorage(limiterA);
    const storageB = new RedisThrottlerStorage(limiterB);

    const first = await storageA.increment("nestjs-route-key", 5000, 1, 5000, "default");
    const second = await storageB.increment("nestjs-route-key", 5000, 1, 5000, "default");

    expect(first).toMatchObject({ totalHits: 1, isBlocked: false, timeToExpire: 5 });
    expect(second).toMatchObject({ totalHits: 2, isBlocked: true });
    expect(second.timeToExpire).toBeGreaterThanOrEqual(1);
    expect(second.timeToExpire).toBeLessThanOrEqual(5);
    expect(second.timeToBlockExpire).toBeGreaterThanOrEqual(1);
    expect(second.timeToBlockExpire).toBeLessThanOrEqual(5);
  });

  it("keeps the counter when an application instance restarts", async () => {
    await limiterA.consume("test:restart", ["restart-subject"], 3, 5000);
    const restartedRedis = new RedisService();
    const restartedLimiter = new DistributedRateLimitService(restartedRedis);

    const next = await restartedLimiter.consume("test:restart", ["restart-subject"], 3, 5000);

    expect(next.count).toBe(2);
    await restartedRedis.close();
  });

  it("expires a fixed window without extending its TTL", async () => {
    const purpose = "test:expiry";
    const identifiers = ["expiry-subject"];
    const key = limiterA.keyFor(purpose, identifiers);
    const first = await limiterA.consume(purpose, identifiers, 1, 80);
    const second = await limiterA.consume(purpose, identifiers, 1, 80);

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(false);
    expect(second.ttlMs).toBeLessThanOrEqual(first.ttlMs);
    await waitForRedisCondition(async () => (await redisA.client.exists(key)) === 0);

    await expect(limiterA.consume(purpose, identifiers, 1, 80)).resolves.toMatchObject({
      allowed: true,
      count: 1
    });
  });

  it("allows no more than the configured maximum under concurrency", async () => {
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        limiterA.consume("test:concurrent", ["concurrent-subject"], 5, 5000)
      )
    );

    expect(results.filter((result) => result.allowed)).toHaveLength(5);
    expect(Math.max(...results.map((result) => result.count))).toBe(20);
  });

  it("does not expose PII in keys and isolates purposes", async () => {
    const email = "ada.lovelace@example.com";
    const ip = "203.0.113.40";
    const loginKey = limiterA.keyFor("test:login", [email, ip]);
    const recoveryKey = limiterA.keyFor("test:recovery", [email, ip]);

    expect(loginKey).toMatch(/^kaklen:rate-limit:test:login:[0-9a-f]{64}$/);
    expect(loginKey).not.toContain(email);
    expect(loginKey).not.toContain(ip);
    expect(loginKey).not.toBe(recoveryKey);
    const login = await limiterA.consume("test:login", [email, ip], 1, 5000);
    const recovery = await limiterA.consume("test:recovery", [email, ip], 1, 5000);
    const storedKeys = await redisA.client.keys(`${redisA.config.rateLimitPrefix}:test:*`);
    expect(login.count).toBe(1);
    expect(recovery.count).toBe(1);
    expect(storedKeys.join(" ")).not.toContain(email);
    expect(storedKeys.join(" ")).not.toContain(ip);
  });

  it("returns a stable 503 instead of falling back when Redis is unavailable", async () => {
    const previousUrl = process.env.REDIS_URL;
    process.env.REDIS_URL = "redis://127.0.0.1:6398";
    const unavailableRedis = new RedisService();
    const unavailableLimiter = new DistributedRateLimitService(unavailableRedis);

    await expect(
      unavailableLimiter.consume("test:unavailable", ["subject"], 1, 1000)
    ).rejects.toMatchObject({
      status: HttpStatus.SERVICE_UNAVAILABLE,
      response: expect.objectContaining({ code: "RATE_LIMIT_BACKEND_UNAVAILABLE" })
    });

    await unavailableRedis.close();
    if (previousUrl === undefined) {
      delete process.env.REDIS_URL;
    } else {
      process.env.REDIS_URL = previousUrl;
    }
  });
});

async function clearIntegrationKeys(redis: RedisService): Promise<void> {
  const keys = await redis.client.keys(`${redis.config.rateLimitPrefix}:test:*`);
  if (keys.length > 0) {
    await redis.client.del(...keys);
  }
}

async function waitForRedisCondition(condition: () => Promise<boolean>): Promise<void> {
  const deadline = Date.now() + 2000;
  while (!(await condition())) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for Redis state");
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
