import { PaymentStatus } from "@prisma/client";
import { SandboxPaymentGateway } from "./sandbox-payment.gateway";

describe("SandboxPaymentGateway", () => {
  beforeEach(() => {
    process.env.PAYMENT_SANDBOX_SECRET = "sandbox-test-secret-at-least-32-characters";
  });

  it("creates unique intents without claiming a real provider", async () => {
    const gateway = new SandboxPaymentGateway();
    const first = await gateway.createPaymentIntent({ amount: "1000.00", currency: "CLP", reference: "QUO-1" });
    const second = await gateway.createPaymentIntent({ amount: "1000.00", currency: "CLP", reference: "QUO-1" });

    expect(first.externalReference).toMatch(/^sandbox_/);
    expect(first.checkoutToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.checkoutToken).not.toBe(first.checkoutToken);
    await expect(gateway.getPaymentStatus(first.externalReference)).resolves.toBe(PaymentStatus.PENDING);
  });

  it("signs canonical webhooks and rejects tampering", () => {
    const gateway = new SandboxPaymentGateway();
    const webhook = gateway.createSignedWebhook("sandbox_1", "PAID", "1000.00", "CLP");

    expect(gateway.verifyWebhookSignature(webhook.payload, webhook.signature)).toBe(true);
    expect(gateway.verifyWebhookSignature({ ...webhook.payload, amount: "999.00" }, webhook.signature)).toBe(false);
    expect(gateway.verifyWebhookSignature(webhook.payload, "invalid")).toBe(false);
  });

  it("implements explicit cancel and refund sandbox outcomes", async () => {
    const gateway = new SandboxPaymentGateway();
    await expect(gateway.cancel("sandbox_1")).resolves.toBe(PaymentStatus.CANCELLED);
    await expect(gateway.refund("sandbox_1", "1000.00")).resolves.toBe(PaymentStatus.REFUNDED);
  });
});
