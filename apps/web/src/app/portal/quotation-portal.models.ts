export type PublicQuotationStatus =
  | "DRAFT"
  | "SENT"
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface PublicQuotationView {
  organization: {
    name: string;
    legalName: string | null;
    taxId: string | null;
    address: string | null;
    phone: string | null;
    whatsapp: string | null;
    country: string;
  };
  client: {
    displayName: string;
    legalName: string | null;
    taxId: string | null;
    email: string | null;
    whatsapp: string | null;
    address: string | null;
  };
  quotation: {
    number: string;
    version: number;
    latestVersion: number;
    isLatestVersion: boolean;
    status: PublicQuotationStatus;
    issueDate: string;
    validUntil: string;
    currency: string;
    subtotal: string;
    lineDiscountTotal: string;
    globalDiscountTotal: string;
    discountTotal: string;
    taxableBase: string;
    taxTotal: string;
    total: string;
    notes: string | null;
    terms: string | null;
    items: Array<{
      index: number;
      code: string | null;
      name: string;
      description: string | null;
      quantity: string;
      unit: string;
      unitPrice: string;
      discountType: "NONE" | "PERCENTAGE" | "FIXED";
      discountValue: string;
      taxPercent: string;
      subtotal: string;
      lineDiscountTotal: string;
      globalDiscountTotal: string;
      discountTotal: string;
      taxableBase: string;
      taxTotal: string;
      total: string;
    }>;
    history: Array<{
      eventCode: string;
      status: PublicQuotationStatus;
      createdAt: string;
    }>;
  };
  link: { expiresAt: string };
  actions: {
    canRequestChanges: boolean;
    canApproveAndPay: boolean;
    canOfferServices: boolean;
  };
}

export interface PublicPaymentIntent {
  paymentId: string;
  status: string;
  checkoutUrl: string;
  amount: string;
  currency: string;
}

export interface PublicPaymentCheckout {
  payment: { status: string; amount: string; currency: string; createdAt: string };
  quotation: { number: string; version: number; clientName: string };
  organization: { name: string };
  /** Live gateway mode, not this payment's history — decides which actions the checkout page may offer right now. */
  mode: "disabled" | "sandbox" | "provider";
  /** @deprecated use `mode === "sandbox"` — kept for backward compatibility with existing consumers. */
  sandbox: boolean;
}
