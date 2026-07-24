import { PaymentStatus } from "@prisma/client";

export interface PaymentIntentInput {
  amount: string;
  currency: string;
  reference: string;
}

export interface PaymentIntentResult {
  externalReference: string;
  checkoutToken: string;
  providerReference: string;
}

export interface PaymentWebhookPayload {
  eventId: string;
  externalReference: string;
  status: "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";
  amount: string;
  currency: string;
}

export interface SignedPaymentWebhook {
  payload: PaymentWebhookPayload;
  signature: string;
}

export interface PaymentGateway {
  createPaymentIntent(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  getPaymentStatus(externalReference: string): Promise<PaymentStatus>;
  processWebhook(payload: PaymentWebhookPayload): PaymentWebhookPayload;
  verifyWebhookSignature(payload: PaymentWebhookPayload, signature: string): boolean;
  cancel(externalReference: string): Promise<PaymentStatus>;
  refund(externalReference: string, amount: string, currency: string): Promise<PaymentStatus>;
  createSignedWebhook(
    externalReference: string,
    status: PaymentWebhookPayload["status"],
    amount: string,
    currency: string
  ): SignedPaymentWebhook;
}

export const PAYMENT_GATEWAY = Symbol("PAYMENT_GATEWAY");

export type PaymentGatewayMode = "disabled" | "sandbox" | "provider";

/**
 * Resolves the concrete gateway to bind to PAYMENT_GATEWAY given the
 * configured mode. Called from a Nest factory provider (see
 * payments.module.ts), so a thrown error here aborts application bootstrap —
 * "provider" mode fails fast because no real adapter is registered in this
 * codebase yet. When one is added, wire it in here alongside "sandbox".
 */
export function resolvePaymentGateway(
  mode: PaymentGatewayMode,
  sandboxGateway: PaymentGateway
): PaymentGateway | null {
  if (mode === "sandbox") {
    return sandboxGateway;
  }
  if (mode === "disabled") {
    return null;
  }
  throw new Error(
    "PAYMENT_GATEWAY=provider has no registered adapter yet. Register a real PaymentGateway implementation before enabling provider mode."
  );
}
