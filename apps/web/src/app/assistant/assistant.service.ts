import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import { AssistedDashboard, ClientTimelineItem, GlobalSearchResponse, OrganizationActivityItem, UserActivation } from "./assistant.models";

@Injectable({ providedIn: "root" })
export class AssistantService {
  constructor(private readonly http: HttpClient) {}

  activation(organizationId: string): Promise<UserActivation> {
    return firstValueFrom(this.http.get<UserActivation>(`${API_BASE_URL}/organizations/${organizationId}/assistant/activation`));
  }

  dashboard(organizationId: string): Promise<AssistedDashboard> {
    return firstValueFrom(this.http.get<AssistedDashboard>(`${API_BASE_URL}/organizations/${organizationId}/assistant/dashboard`));
  }

  search(organizationId: string, query: string, limit = 5): Promise<GlobalSearchResponse> {
    const params = new HttpParams().set("query", query).set("limit", limit);
    return firstValueFrom(this.http.get<GlobalSearchResponse>(`${API_BASE_URL}/organizations/${organizationId}/assistant/search`, { params }));
  }

  activity(organizationId: string, limit = 10): Promise<OrganizationActivityItem[]> {
    const params = new HttpParams().set("limit", limit);
    return firstValueFrom(this.http.get<OrganizationActivityItem[]>(`${API_BASE_URL}/organizations/${organizationId}/assistant/activity`, { params }));
  }

  clientTimeline(organizationId: string, clientId: string): Promise<ClientTimelineItem[]> {
    return firstValueFrom(this.http.get<ClientTimelineItem[]>(`${API_BASE_URL}/organizations/${organizationId}/assistant/clients/${clientId}/timeline`));
  }
}
