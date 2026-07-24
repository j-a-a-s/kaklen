import { PaymentGateway } from "./payment-gateway";
import { resolvePaymentGateway } from "./payment-gateway";

describe("resolvePaymentGateway", () => {
  const sandboxGateway = {} as PaymentGateway;

  it("binds the sandbox gateway in sandbox mode", () => {
    expect(resolvePaymentGateway("sandbox", sandboxGateway)).toBe(sandboxGateway);
  });

  it("binds no gateway in disabled mode", () => {
    expect(resolvePaymentGateway("disabled", sandboxGateway)).toBeNull();
  });

  it("fails closed in provider mode since no real adapter is registered yet", () => {
    expect(() => resolvePaymentGateway("provider", sandboxGateway)).toThrow(
      /PAYMENT_GATEWAY=provider has no registered adapter/
    );
  });
});
