import { EmailVerificationRateLimitService } from "./email-verification-rate-limit.service";

describe("EmailVerificationRateLimitService", () => {
  it("limits repeated resend requests per normalized email window", () => {
    const service = new EmailVerificationRateLimitService();
    const now = Date.now();

    expect(service.allowResend("ada@example.com", now)).toBe(true);
    expect(service.allowResend("ada@example.com", now + 1)).toBe(true);
    expect(service.allowResend("ada@example.com", now + 2)).toBe(true);
    expect(service.allowResend("ada@example.com", now + 3)).toBe(false);
    expect(service.allowResend("other@example.com", now + 3)).toBe(true);
  });

  it("opens a new window after fifteen minutes", () => {
    const service = new EmailVerificationRateLimitService();
    const now = Date.now();
    service.allowResend("ada@example.com", now);
    service.allowResend("ada@example.com", now + 1);
    service.allowResend("ada@example.com", now + 2);

    expect(service.allowResend("ada@example.com", now + 15 * 60 * 1000)).toBe(true);
  });
});
