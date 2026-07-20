import { RedisService } from "./redis.service";

describe("RedisService connection options", () => {
  const originalEnvironment = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnvironment };
  });

  it.each([
    ["redis://cache.example:6379/3", false],
    ["rediss://cache.example:6380/4", true]
  ] as const)("configures TLS only for rediss URLs", (redisUrl, expectsTls) => {
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = redisUrl;
    process.env.RATE_LIMIT_HASH_SECRET = "redis-service-test-secret";

    const service = new RedisService();

    expect(service.client.options.tls !== undefined).toBe(expectsTls);
    expect(service.workerOptions().tls !== undefined).toBe(expectsTls);
    expect(service.client.options.db).toBe(Number(new URL(redisUrl).pathname.slice(1)));
    service.client.disconnect(false);
  });
});
