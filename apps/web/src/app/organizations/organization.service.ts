import { HttpClient } from "@angular/common/http";
import { Injectable, computed, signal } from "@angular/core";
import { firstValueFrom, tap } from "rxjs";
import { LocaleService } from "../i18n/locale.service";
import {
  Organization,
  OrganizationInvitation,
  OrganizationMember,
  OrganizationRole,
  Permission
} from "./organization.models";

const API_URL = "http://localhost:3000/api";
const ACTIVE_ORGANIZATION_KEY = "kaklen.activeOrganizationId";

@Injectable({ providedIn: "root" })
export class OrganizationService {
  readonly organizations = signal<Organization[]>([]);
  readonly activeOrganizationId = signal<string | null>(localStorage.getItem(ACTIVE_ORGANIZATION_KEY));
  readonly permissions = signal<Permission[]>([]);
  readonly activeOrganization = computed(
    () =>
      this.organizations().find((organization) => organization.id === this.activeOrganizationId()) ??
      null
  );

  constructor(
    private readonly http: HttpClient,
    private readonly localeService: LocaleService
  ) {}

  async list(): Promise<Organization[]> {
    const organizations = await firstValueFrom(
      this.http.get<Organization[]>(`${API_URL}/organizations`, { withCredentials: true })
    );
    this.organizations.set(organizations);
    this.localeService.applyOrganizationDefault(this.activeOrganization()?.defaultLocale ?? organizations[0]?.defaultLocale);

    if (!this.activeOrganizationId() && organizations[0]) {
      await this.setActiveOrganization(organizations[0].id);
    }

    return organizations;
  }

  async setActiveOrganization(organizationId: string): Promise<void> {
    this.activeOrganizationId.set(organizationId);
    localStorage.setItem(ACTIVE_ORGANIZATION_KEY, organizationId);
    this.localeService.applyOrganizationDefault(this.activeOrganization()?.defaultLocale);
    await this.loadPermissions(organizationId);
  }

  create(payload: { name: string; legalName?: string; taxId?: string }): Promise<Organization> {
    return firstValueFrom(
      this.http
        .post<Organization>(`${API_URL}/organizations`, payload, { withCredentials: true })
        .pipe(tap((organization) => this.organizations.update((items) => [...items, organization])))
    );
  }

  get(organizationId: string): Promise<Organization> {
    return firstValueFrom(
      this.http.get<Organization>(`${API_URL}/organizations/${organizationId}`, {
        withCredentials: true
      })
    );
  }

  update(
    organizationId: string,
    payload: {
      name?: string;
      legalName?: string | null;
      taxId?: string | null;
      country?: string;
      currency?: string;
      timezone?: string;
      dateFormat?: string;
      numberFormat?: string;
    }
  ): Promise<Organization> {
    return firstValueFrom(
      this.http
        .patch<Organization>(`${API_URL}/organizations/${organizationId}`, payload, {
          withCredentials: true
        })
        .pipe(
          tap((organization) =>
            this.organizations.update((items) =>
              items.map((item) => (item.id === organization.id ? organization : item))
            )
          )
        )
    );
  }

  members(organizationId: string): Promise<OrganizationMember[]> {
    return firstValueFrom(
      this.http.get<OrganizationMember[]>(`${API_URL}/organizations/${organizationId}/members`, {
        withCredentials: true
      })
    );
  }

  updateMember(
    organizationId: string,
    membershipId: string,
    role: OrganizationRole
  ): Promise<OrganizationMember> {
    return firstValueFrom(
      this.http.patch<OrganizationMember>(
        `${API_URL}/organizations/${organizationId}/members/${membershipId}`,
        { role },
        { withCredentials: true }
      )
    );
  }

  removeMember(organizationId: string, membershipId: string): Promise<void> {
    return firstValueFrom(
      this.http.delete<void>(`${API_URL}/organizations/${organizationId}/members/${membershipId}`, {
        withCredentials: true
      })
    );
  }

  invite(
    organizationId: string,
    payload: { email: string; role: OrganizationRole }
  ): Promise<OrganizationInvitation> {
    return firstValueFrom(
      this.http.post<OrganizationInvitation>(
        `${API_URL}/organizations/${organizationId}/invitations`,
        payload,
        { withCredentials: true }
      )
    );
  }

  invitations(organizationId: string): Promise<OrganizationInvitation[]> {
    return firstValueFrom(
      this.http.get<OrganizationInvitation[]>(
        `${API_URL}/organizations/${organizationId}/invitations`,
        { withCredentials: true }
      )
    );
  }

  acceptInvitation(token: string): Promise<Organization> {
    return firstValueFrom(
      this.http
        .post<Organization>(
          `${API_URL}/organization-invitations/accept`,
          { token },
          { withCredentials: true }
        )
        .pipe(tap((organization) => this.organizations.update((items) => [...items, organization])))
    );
  }

  hasPermission(permission: Permission): boolean {
    return this.permissions().includes(permission);
  }

  private async loadPermissions(organizationId: string): Promise<void> {
    const response = await firstValueFrom(
      this.http.get<{ permissions: Permission[] }>(
        `${API_URL}/organizations/${organizationId}/me/permissions`,
        { withCredentials: true }
      )
    );
    this.permissions.set(response.permissions);
  }
}
