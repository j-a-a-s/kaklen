import { HttpException } from "@nestjs/common";
import { PasswordRecoveryRateLimitService } from "./password-recovery-rate-limit.service";

describe("PasswordRecoveryRateLimitService", () => {
  it("silently limits forgot-password by normalized email", () => {
    const limiter = new PasswordRecoveryRateLimitService();

    expect(limiter.allowForgot("user@example.com", "127.0.0.1")).toBe(true);
    expect(limiter.allowForgot("user@example.com", "127.0.0.2")).toBe(true);
    expect(limiter.allowForgot("user@example.com", "127.0.0.3")).toBe(true);
    expect(limiter.allowForgot("user@example.com", "127.0.0.4")).toBe(false);
  });

  it("rejects reset abuse by token without retaining the plain token", () => {
    const limiter = new PasswordRecoveryRateLimitService();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      limiter.assertResetAllowed("secret-reset-token", `127.0.0.${attempt + 1}`);
    }

    expect(() => limiter.assertResetAllowed("secret-reset-token", "127.0.0.20")).toThrow(
      HttpException
    );
    expect(JSON.stringify(limiter)).not.toContain("secret-reset-token");
  });
});
