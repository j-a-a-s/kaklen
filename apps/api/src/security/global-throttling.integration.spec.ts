import { Controller, Get, INestApplication, Module, Post } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { SkipThrottle, Throttle } from "@nestjs/throttler";
import request from "supertest";
import { HealthController } from "../health/health.controller";
import { HealthService } from "../health/health.service";
import { RedisService } from "../redis/redis.service";
import { DistributedThrottlingModule } from "./distributed-throttling.module";

@Controller("global-probe")
class GlobalProbeController {
  @Get()
  get(): { ok: true } {
    return { ok: true };
  }
}

@Controller("auth-throttle-probe")
class AuthThrottleProbeController {
  @Post("refresh")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  refresh(): { ok: true } {
    return { ok: true };
  }

  @Post("logout")
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  logout(): { ok: true } {
    return { ok: true };
  }

  @Post("manual")
  @SkipThrottle()
  manual(): { ok: true } {
    return { ok: true };
  }
}

@Module({
  imports: [DistributedThrottlingModule],
  controllers: [GlobalProbeController, AuthThrottleProbeController, HealthController],
  providers: [
    {
      provide: HealthService,
      useValue: {
        getHealth: () => ({ status: "ok" }),
        getLive: () => ({ status: "ok" }),
        getReady: async () => ({ status: "ok" }),
        getNotReady: () => ({ status: "error" })
      }
    }
  ]
})
class GlobalThrottleTestModule {}

describe("global Redis throttling", () => {
  const originalEnvironment = { ...process.env };
  let appA: INestApplication;
  let appB: INestApplication;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.REDIS_URL = "redis://localhost:6379/11";
    process.env.RATE_LIMIT_HASH_SECRET = "global-throttling-integration-secret";
    appA = await createTestApplication();
    appB = await createTestApplication();
    await Promise.all([appA.get(RedisService).ping(), appB.get(RedisService).ping()]);
  });

  beforeEach(async () => {
    await clearThrottleKeys(appA.get(RedisService));
  });

  afterAll(async () => {
    await clearThrottleKeys(appA.get(RedisService));
    await Promise.all([appA.close(), appB.close()]);
    process.env = { ...originalEnvironment };
  });

  it("limits an unauthenticated endpoint globally on request 101", async () => {
    const allowed = await Promise.all(
      Array.from({ length: 100 }, () => request(appA.getHttpServer()).get("/global-probe"))
    );
    const limited = await request(appA.getHttpServer()).get("/global-probe");

    expect(allowed.every((response) => response.status === 200)).toBe(true);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    expect(Number(limited.headers["retry-after"])).toBeLessThanOrEqual(60);
  });

  it("shares the global counter between two application instances", async () => {
    const fromA = await Promise.all(
      Array.from({ length: 50 }, () => request(appA.getHttpServer()).get("/global-probe"))
    );
    const fromB = await Promise.all(
      Array.from({ length: 50 }, () => request(appB.getHttpServer()).get("/global-probe"))
    );
    const limited = await request(appB.getHttpServer()).get("/global-probe");

    expect([...fromA, ...fromB].every((response) => response.status === 200)).toBe(true);
    expect(limited.status).toBe(429);
  });

  it("keeps the global counter when an application instance restarts", async () => {
    const firstInstance = await createTestApplication();
    const initial = await Promise.all(
      Array.from({ length: 60 }, () =>
        request(firstInstance.getHttpServer()).get("/global-probe")
      )
    );
    expect(initial.every((response) => response.status === 200)).toBe(true);
    await firstInstance.close();

    const restartedInstance = await createTestApplication();
    const remaining = await Promise.all(
      Array.from({ length: 40 }, () =>
        request(restartedInstance.getHttpServer()).get("/global-probe")
      )
    );
    const limited = await request(restartedInstance.getHttpServer()).get("/global-probe");

    expect(remaining.every((response) => response.status === 200)).toBe(true);
    expect(limited.status).toBe(429);
    await restartedInstance.close();
  });

  it.each(["refresh", "logout"])(
    "applies exactly one 20 request policy to %s",
    async (endpoint) => {
      const allowed = await Promise.all(
        Array.from({ length: 20 }, () =>
          request(appA.getHttpServer()).post(`/auth-throttle-probe/${endpoint}`)
        )
      );
      const limited = await request(appA.getHttpServer()).post(
        `/auth-throttle-probe/${endpoint}`
      );

      expect(allowed.every((response) => response.status === 201)).toBe(true);
      expect(limited.status).toBe(429);
    }
  );

  it("does not consume the global policy for manually limited authentication routes", async () => {
    const responses = await Promise.all(
      Array.from({ length: 110 }, () =>
        request(appA.getHttpServer()).post("/auth-throttle-probe/manual")
      )
    );
    const keys = await throttleKeys(appA.get(RedisService));

    expect(responses.every((response) => response.status === 201)).toBe(true);
    expect(keys).toEqual([]);
  });

  it("never throttles health endpoints", async () => {
    const responses = await Promise.all(
      Array.from({ length: 110 }, () => request(appA.getHttpServer()).get("/health/live"))
    );
    const keys = await throttleKeys(appA.get(RedisService));

    expect(responses.every((response) => response.status === 200)).toBe(true);
    expect(keys).toEqual([]);
  });
});

async function createTestApplication(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [GlobalThrottleTestModule]
  }).compile();
  const app = moduleRef.createNestApplication();
  await app.listen(0, "127.0.0.1");
  return app;
}

async function throttleKeys(redis: RedisService): Promise<string[]> {
  return redis.client.keys(`${redis.config.rateLimitPrefix}:throttler:*`);
}

async function clearThrottleKeys(redis: RedisService): Promise<void> {
  const keys = await throttleKeys(redis);
  if (keys.length > 0) {
    await redis.client.del(...keys);
  }
}
