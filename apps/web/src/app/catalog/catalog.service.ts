import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import { CatalogItem, CatalogItemStatus, CatalogItemType, PaginatedCatalogItems } from "./catalog.models";

const API_URL = API_BASE_URL;

export interface CatalogItemPayload {
  type: CatalogItemType;
  status?: CatalogItemStatus;
  sku?: string;
  code?: string;
  name?: string;
  description?: string;
  unit?: string;
  cost?: number;
  price?: number;
  taxPercent?: number;
  currency?: string;
}

@Injectable({ providedIn: "root" })
export class CatalogService {
  constructor(private readonly http: HttpClient) {}

  list(
    organizationId: string,
    filters: Record<string, string | number | boolean | undefined>
  ): Promise<PaginatedCatalogItems> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return firstValueFrom(
      this.http.get<PaginatedCatalogItems>(`${API_URL}/organizations/${organizationId}/catalog`, {
        params,
        withCredentials: true
      })
    );
  }

  create(organizationId: string, payload: CatalogItemPayload): Promise<CatalogItem> {
    return firstValueFrom(
      this.http.post<CatalogItem>(`${API_URL}/organizations/${organizationId}/catalog`, payload, {
        withCredentials: true
      })
    );
  }

  get(organizationId: string, itemId: string): Promise<CatalogItem> {
    return firstValueFrom(
      this.http.get<CatalogItem>(`${API_URL}/organizations/${organizationId}/catalog/${itemId}`, {
        withCredentials: true
      })
    );
  }

  update(organizationId: string, itemId: string, payload: CatalogItemPayload): Promise<CatalogItem> {
    return firstValueFrom(
      this.http.patch<CatalogItem>(
        `${API_URL}/organizations/${organizationId}/catalog/${itemId}`,
        payload,
        { withCredentials: true }
      )
    );
  }

  archive(organizationId: string, itemId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_URL}/organizations/${organizationId}/catalog/${itemId}`, {
        withCredentials: true
      })
    );
  }
}
