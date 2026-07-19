import { RateLimitBackendUnavailableException } from "../common/rate-limit-exceptions";
import type { DistributedRateLimitService } from "../security/distributed-rate-limit.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

describe("AuthRateLimitService", () => {
  const context = { ipAddress: "203.0.113.50" };

  it("applies register and login policies to IP and normalized email", async () => {
    const distributed = createDistributedRateLimits();
    const service = new AuthRateLimitService(
      distributed as unknown as DistributedRateLimitService
    );

    await service.assertRegisterAllowed(context);
    await service.assertLoginAllowed(" ADA@Example.com ", context);

    expect(distributed.consume).toHaveBeenNthCalledWith(
      1,
      "register:ip",
      [context.ipAddress],
      3,
      60_000
    );
    expect(distributed.consume).toHaveBeenNthCalledWith(
      2,
      "login:ip",
      [context.ipAddress],
      5,
      60_000
    );
    expect(distributed.consume).toHaveBeenNthCalledWith(
      3,
      "login:email",
      ["ada@example.com"],
      5,
      60_000
    );
  });

  it("uses generic suppression for forgot and resend limits", async () => {
    const distributed = createDistributedRateLimits(false);
    const service = new AuthRateLimitService(
      distributed as unknown as DistributedRateLimitService
    );

    await expect(service.allowForgotPassword("ada@example.com", context)).resolves.toBe(false);
    await expect(service.allowVerificationResend("ada@example.com", context)).resolves.toBe(false);
  });

  it("throws a 429 with retry metadata for reset and verification", async () => {
    const distributed = createDistributedRateLimits(false, 47);
    const service = new AuthRateLimitService(
      distributed as unknown as DistributedRateLimitService
    );

    await expect(service.assertResetPasswordAllowed("raw-reset-token", context)).rejects.toMatchObject({
      status: 429,
      retryAfterSeconds: 47
    });
    await expect(
      service.assertEmailVerificationAllowed("raw-verification-token", context)
    ).rejects.toMatchObject({ status: 429, retryAfterSeconds: 47 });

    const tokenCalls = distributed.consume.mock.calls.filter(([purpose]) =>
      String(purpose).endsWith(":token")
    );
    expect(tokenCalls).toHaveLength(2);
    for (const call of tokenCalls) {
      expect(call[1]).toEqual([expect.stringMatching(/^[0-9a-f]{64}$/)]);
      expect(JSON.stringify(call[1])).not.toContain("raw-");
    }
  });

  it("propagates Redis failure without an in-memory fallback", async () => {
    const distributed = createDistributedRateLimits();
    distributed.consume.mockRejectedValueOnce(new RateLimitBackendUnavailableException());
    const service = new AuthRateLimitService(
      distributed as unknown as DistributedRateLimitService
    );

    await expect(service.assertRegisterAllowed(context)).rejects.toMatchObject({
      status: 503,
      response: expect.objectContaining({ code: "RATE_LIMIT_BACKEND_UNAVAILABLE" })
    });
  });
});

function createDistributedRateLimits(allowed = true, retryAfterSeconds = 60) {
  return {
    consume: jest.fn(
      async (
        _purpose: string,
        _identifiers: readonly string[],
        _limit: number,
        _windowMs: number
      ) => ({
        allowed,
        count: allowed ? 1 : 6,
        ttlMs: retryAfterSeconds * 1000,
        retryAfterSeconds
      })
    ),
    hashSensitive: jest.fn((value: string) => `hash:${value}`)
  };
}
