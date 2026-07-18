import { Client } from "../clients/client.models";
import type { QuotationDecimalInput } from "@kaklen/shared";

export type QuotationStatus = "DRAFT" | "SENT" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED" | "EXPIRED" | "CANCELLED";
export type QuotationItemType = "PRODUCT" | "SERVICE" | "CUSTOM";
export type QuotationDiscountType = "NONE" | "PERCENTAGE" | "FIXED";

export interface QuotationItem {
  id: string;
  quotationId: string;
  catalogItemId: string | null;
  type: QuotationItemType;
  code: string | null;
  name: string;
  description: string | null;
  quantity: string;
  unit: string;
  unitPrice: string;
  discountType: QuotationDiscountType;
  discountValue: string;
  taxPercent: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  sortOrder: number;
}

export interface QuotationStatusHistory {
  id: string;
  previousStatus: QuotationStatus | null;
  newStatus: QuotationStatus;
  note: string | null;
  createdAt: string;
  changedBy?: {
    firstName: string;
    lastName: string;
  } | null;
}

export interface QuotationChangeRequest {
  id: string;
  quotationId: string;
  quotationVersion: number;
  comment: string;
  itemIndexes: number[];
  items: Array<{ index: number; name: string; code: string | null }>;
  createdAt: string;
}

export interface QuotationEmailPayload {
  to: string;
  subject: string;
  message: string;
  locale: "es" | "en" | "pt-BR";
}

export interface Quotation {
  id: string;
  organizationId: string;
  clientId: string;
  number: string;
  version: number;
  status: QuotationStatus;
  issueDate: string;
  validUntil: string;
  currency: string;
  globalDiscountPercent: string;
  subtotal: string;
  discountTotal: string;
  taxTotal: string;
  total: string;
  notes: string | null;
  terms: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  sentAt: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  client: Client;
  items: QuotationItem[];
  history?: QuotationStatusHistory[];
}

export interface QuotationItemPayload {
  catalogItemId?: string;
  type: QuotationItemType;
  code?: string;
  name: string;
  description?: string;
  quantity: QuotationDecimalInput;
  unit: string;
  unitPrice: QuotationDecimalInput;
  discountType?: QuotationDiscountType;
  discountValue?: QuotationDecimalInput;
  taxPercent: QuotationDecimalInput;
}

export interface QuotationPayload {
  clientId: string;
  issueDate: string;
  validUntil: string;
  currency?: string;
  globalDiscountPercent?: QuotationDecimalInput;
  notes?: string;
  terms?: string;
  items: QuotationItemPayload[];
}

export interface PaginatedQuotations {
  items: Quotation[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface QuotationSummary {
  total: number;
  draft: number;
  sent: number;
  changesRequested: number;
  approved: number;
  rejected: number;
  expired: number;
  cancelled: number;
  baseCurrency: string;
  approvedAmounts: Array<{ currency: string; amount: string; quotationCount: number }>;
  baseCurrencyApprovedAmount: string;
}
