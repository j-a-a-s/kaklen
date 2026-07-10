import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  PaginatedQuotations,
  Quotation,
  QuotationPayload,
  QuotationStatusHistory,
  QuotationSummary
} from "./quotation.models";

const API_URL = "http://localhost:3000/api";

@Injectable({ providedIn: "root" })
export class QuotationsService {
  constructor(private readonly http: HttpClient) {}

  list(organizationId: string, filters: Record<string, string | number | undefined>): Promise<PaginatedQuotations> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return firstValueFrom(
      this.http.get<PaginatedQuotations>(`${API_URL}/organizations/${organizationId}/quotations`, {
        params,
        withCredentials: true
      })
    );
  }

  summary(organizationId: string): Promise<QuotationSummary> {
    return firstValueFrom(
      this.http.get<QuotationSummary>(`${API_URL}/organizations/${organizationId}/quotations/summary`, {
        withCredentials: true
      })
    );
  }

  create(organizationId: string, payload: QuotationPayload): Promise<Quotation> {
    return firstValueFrom(
      this.http.post<Quotation>(`${API_URL}/organizations/${organizationId}/quotations`, payload, {
        withCredentials: true
      })
    );
  }

  get(organizationId: string, quotationId: string): Promise<Quotation> {
    return firstValueFrom(
      this.http.get<Quotation>(`${API_URL}/organizations/${organizationId}/quotations/${quotationId}`, {
        withCredentials: true
      })
    );
  }

  update(organizationId: string, quotationId: string, payload: QuotationPayload): Promise<Quotation> {
    return firstValueFrom(
      this.http.patch<Quotation>(`${API_URL}/organizations/${organizationId}/quotations/${quotationId}`, payload, {
        withCredentials: true
      })
    );
  }

  changeStatus(
    organizationId: string,
    quotationId: string,
    action: "send" | "approve" | "reject" | "cancel"
  ): Promise<Quotation> {
    return firstValueFrom(
      this.http.post<Quotation>(
        `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/${action}`,
        {},
        { withCredentials: true }
      )
    );
  }

  newVersion(organizationId: string, quotationId: string): Promise<Quotation> {
    return firstValueFrom(
      this.http.post<Quotation>(
        `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/new-version`,
        {},
        { withCredentials: true }
      )
    );
  }

  history(organizationId: string, quotationId: string): Promise<QuotationStatusHistory[]> {
    return firstValueFrom(
      this.http.get<QuotationStatusHistory[]>(
        `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/history`,
        { withCredentials: true }
      )
    );
  }

  pdfUrl(organizationId: string, quotationId: string, locale: string): string {
    return `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/pdf?locale=${encodeURIComponent(locale)}`;
  }
}
