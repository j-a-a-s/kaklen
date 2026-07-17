import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import {
  PublicPaymentCheckout,
  PublicPaymentIntent,
  PublicQuotationView
} from "./quotation-portal.models";

@Injectable({ providedIn: "root" })
export class QuotationPortalService {
  constructor(private readonly http: HttpClient) {}

  view(publicToken: string): Promise<PublicQuotationView> {
    return firstValueFrom(
      this.http.get<PublicQuotationView>(`${API_BASE_URL}/portal/quotations/${publicToken}`)
    );
  }

  requestChanges(publicToken: string, comment: string, itemIndexes: number[]): Promise<{ status: string }> {
    return firstValueFrom(
      this.http.post<{ status: string }>(
        `${API_BASE_URL}/portal/quotations/${publicToken}/change-requests`,
        { comment, itemIndexes }
      )
    );
  }

  createPayment(
    publicToken: string,
    idempotencyKey: string,
    locale: "es" | "en" | "pt-BR"
  ): Promise<PublicPaymentIntent> {
    return firstValueFrom(
      this.http.post<PublicPaymentIntent>(
        `${API_BASE_URL}/portal/quotations/${publicToken}/payments`,
        { idempotencyKey, locale }
      )
    );
  }

  checkout(checkoutToken: string): Promise<PublicPaymentCheckout> {
    return firstValueFrom(
      this.http.get<PublicPaymentCheckout>(`${API_BASE_URL}/portal/payments/checkout/${checkoutToken}`)
    );
  }

  completePayment(checkoutToken: string, outcome: "PAID" | "FAILED"): Promise<{ status: string }> {
    return firstValueFrom(
      this.http.post<{ status: string }>(
        `${API_BASE_URL}/portal/payments/checkout/${checkoutToken}/complete`,
        { outcome }
      )
    );
  }

  recommendationShown(publicToken: string): Promise<void> {
    return firstValueFrom(
      this.http.post<void>(
        `${API_BASE_URL}/portal/quotations/${publicToken}/provider-profile/recommendation-view`,
        {}
      )
    );
  }

  createProviderProfile(publicToken: string, payload: ProviderProfilePayload): Promise<{ status: string }> {
    return firstValueFrom(
      this.http.post<{ status: string }>(
        `${API_BASE_URL}/portal/quotations/${publicToken}/provider-profile`,
        payload
      )
    );
  }
}

export interface ProviderProfilePayload {
  consent: true;
  category: string;
  description: string;
  country: "CL" | "AR" | "BR" | "MX" | "US";
  region?: string;
  city?: string;
  whatsapp: string;
  price?: number;
  currency: string;
  portfolioUrl?: string;
}
