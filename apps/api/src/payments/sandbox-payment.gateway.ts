import { Injectable } from "@nestjs/common";
import { PaymentStatus } from "@prisma/client";
import { readProductIntegrationsConfig } from "@kaklen/config";
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  PaymentGateway,
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentWebhookPayload,
  SignedPaymentWebhook
} from "./payment-gateway";

@Injectable()
export class SandboxPaymentGateway implements PaymentGateway {
  private readonly secret = readProductIntegrationsConfig(process.env).paymentSandboxSecret;

  async createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      externalReference: `sandbox_${randomUUID()}`,
      checkoutToken: randomBytes(32).toString("base64url"),
      providerReference: `sandbox:${input.reference}`
    };
  }

  async getPaymentStatus(_externalReference: string): Promise<PaymentStatus> {
    return PaymentStatus.PENDING;
  }

  processWebhook(payload: PaymentWebhookPayload): PaymentWebhookPayload {
    return payload;
  }

  verifyWebhookSignature(payload: PaymentWebhookPayload, signature: string): boolean {
    const expected = this.signature(payload);
    const received = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expected, "hex");
    return received.length === expectedBuffer.length && timingSafeEqual(received, expectedBuffer);
  }

  async cancel(_externalReference: string): Promise<PaymentStatus> {
    return PaymentStatus.CANCELLED;
  }

  async refund(_externalReference: string, _amount: string): Promise<PaymentStatus> {
    return PaymentStatus.REFUNDED;
  }

  createSignedWebhook(
    externalReference: string,
    status: PaymentWebhookPayload["status"],
    amount: string,
    currency: string
  ): SignedPaymentWebhook {
    const payload: PaymentWebhookPayload = {
      eventId: `sandbox_event_${randomUUID()}`,
      externalReference,
      status,
      amount,
      currency
    };
    return { payload, signature: this.signature(payload) };
  }

  private signature(payload: PaymentWebhookPayload): string {
    return createHmac("sha256", this.secret)
      .update(canonicalPaymentWebhook(payload), "utf8")
      .digest("hex");
  }
}

export function canonicalPaymentWebhook(payload: PaymentWebhookPayload): string {
  return [
    payload.eventId,
    payload.externalReference,
    payload.status,
    payload.amount,
    payload.currency
  ].join("\n");
}
