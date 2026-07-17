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
