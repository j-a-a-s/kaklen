import { HttpClient, HttpParams, HttpResponse } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import {
  PaginatedQuotations,
  Quotation,
  QuotationEmailPayload,
  QuotationPayload,
  QuotationStatusHistory,
  QuotationSummary
} from "./quotation.models";

const API_URL = API_BASE_URL;

export interface QuotationPdfDownload {
  blob: Blob;
  filename: string;
}

export interface QuotationPublicLink {
  id: string;
  expiresAt: string;
  publicToken: string;
  path: string;
  url: string;
}

export interface PreparedWhatsApp {
  id: string;
  mode: "manual" | "provider";
  status: "PREPARED" | "SENT";
  message: string;
  publicUrl: string;
  waUrl?: string;
}

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

  async downloadPdf(organizationId: string, quotationId: string, locale: string): Promise<QuotationPdfDownload> {
    const params = new HttpParams().set("locale", locale);
    const response = await firstValueFrom(
      this.http.get(`${API_URL}/organizations/${organizationId}/quotations/${quotationId}/pdf`, {
        params,
        observe: "response",
        responseType: "blob",
        withCredentials: true
      })
    );
    return {
      blob: response.body ?? new Blob([], { type: "application/pdf" }),
      filename: this.responseFilename(response, `quotation-${quotationId}.pdf`)
    };
  }

  sendEmail(
    organizationId: string,
    quotationId: string,
    payload: QuotationEmailPayload
  ): Promise<Quotation> {
    return firstValueFrom(
      this.http.post<Quotation>(
        `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/email`,
        payload,
        { withCredentials: true }
      )
    );
  }

  createPublicLink(
    organizationId: string,
    quotationId: string,
    locale: "es" | "en" | "pt-BR"
  ): Promise<QuotationPublicLink> {
    return firstValueFrom(this.http.post<QuotationPublicLink>(
      `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/public-link`,
      { expiresInHours: 168, locale },
      { withCredentials: true }
    ));
  }

  prepareWhatsApp(
    organizationId: string,
    quotationId: string,
    publicToken: string,
    locale: "es" | "en" | "pt-BR"
  ): Promise<PreparedWhatsApp> {
    return firstValueFrom(this.http.post<PreparedWhatsApp>(
      `${API_URL}/organizations/${organizationId}/quotations/${quotationId}/whatsapp/prepare`,
      { publicToken, locale },
      { withCredentials: true }
    ));
  }

  private responseFilename(response: HttpResponse<Blob>, fallback: string): string {
    const disposition = response.headers.get("Content-Disposition") ?? response.headers.get("content-disposition") ?? "";
    const encoded = /filename\*=UTF-8''([^;]+)/i.exec(disposition)?.[1];
    if (encoded) {
      try {
        return decodeURIComponent(encoded);
      } catch {
        return fallback;
      }
    }
    return /filename="?([^";]+)"?/i.exec(disposition)?.[1] ?? fallback;
  }
}
