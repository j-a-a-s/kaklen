import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import {
  Client,
  ClientInteraction,
  ClientInteractionType,
  ClientStatus,
  ClientSummary,
  ClientType,
  PaginatedClients
} from "./client.models";

const API_URL = "http://localhost:3000/api";

export interface ClientPayload {
  type: ClientType;
  status?: ClientStatus;
  firstName?: string;
  lastName?: string;
  legalName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  country?: string;
  region?: string;
  city?: string;
  address?: string;
  notes?: string;
}

@Injectable({ providedIn: "root" })
export class ClientsService {
  constructor(private readonly http: HttpClient) {}

  list(organizationId: string, filters: Record<string, string | number | boolean | undefined>): Promise<PaginatedClients> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") {
        params = params.set(key, String(value));
      }
    });
    return firstValueFrom(
      this.http.get<PaginatedClients>(`${API_URL}/organizations/${organizationId}/clients`, {
        params,
        withCredentials: true
      })
    );
  }

  summary(organizationId: string): Promise<ClientSummary> {
    return firstValueFrom(
      this.http.get<ClientSummary>(`${API_URL}/organizations/${organizationId}/clients/summary`, {
        withCredentials: true
      })
    );
  }

  create(organizationId: string, payload: ClientPayload): Promise<Client> {
    return firstValueFrom(
      this.http.post<Client>(`${API_URL}/organizations/${organizationId}/clients`, payload, {
        withCredentials: true
      })
    );
  }

  get(organizationId: string, clientId: string): Promise<Client> {
    return firstValueFrom(
      this.http.get<Client>(`${API_URL}/organizations/${organizationId}/clients/${clientId}`, {
        withCredentials: true
      })
    );
  }

  update(organizationId: string, clientId: string, payload: ClientPayload): Promise<Client> {
    return firstValueFrom(
      this.http.patch<Client>(`${API_URL}/organizations/${organizationId}/clients/${clientId}`, payload, {
        withCredentials: true
      })
    );
  }

  archive(organizationId: string, clientId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_URL}/organizations/${organizationId}/clients/${clientId}`, {
        withCredentials: true
      })
    );
  }

  interactions(organizationId: string, clientId: string): Promise<ClientInteraction[]> {
    return firstValueFrom(
      this.http.get<ClientInteraction[]>(
        `${API_URL}/organizations/${organizationId}/clients/${clientId}/interactions`,
        { withCredentials: true }
      )
    );
  }

  addInteraction(
    organizationId: string,
    clientId: string,
    payload: { type: ClientInteractionType; subject?: string; description: string }
  ): Promise<ClientInteraction> {
    return firstValueFrom(
      this.http.post<ClientInteraction>(
        `${API_URL}/organizations/${organizationId}/clients/${clientId}/interactions`,
        payload,
        { withCredentials: true }
      )
    );
  }
}
