import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { firstValueFrom, tap } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import { LocaleService } from "../i18n/locale.service";
import { OrganizationService } from "../organizations/organization.service";
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest, UpdatePreferencesRequest } from "./auth.models";

const API_URL = API_BASE_URL;
const PRIVATE_STORAGE_KEYS = new Set([
  "kaklen.activeOrganizationId",
  "kaklen.user",
  "kaklen.auth",
  "kaklen.accessToken",
  "kaklen.refreshToken",
  "kaklen.permissions",
  "kaklen.membership",
  "kaklen.activeMembershipId",
  "kaklen.onboarding",
  "kaklen.privateNavigation"
]);
const PRIVATE_STORAGE_PREFIXES = [
  "kaklen.user.",
  "kaklen.auth.",
  "kaklen.organization.",
  "kaklen.organizations.",
  "kaklen.permission.",
  "kaklen.permissions.",
  "kaklen.membership.",
  "kaklen.onboarding.",
  "kaklen.privateNavigation."
];

@Injectable({ providedIn: "root" })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  private accessToken: string | null = null;
  private refreshPromise: Promise<AuthResponse> | null = null;
  private sessionVersion = 0;

  constructor(
    private readonly http: HttpClient,
    private readonly localeService: LocaleService,
    private readonly organizationService: OrganizationService
  ) {}

  getAccessToken(): string | null {
    return this.accessToken;
  }

  register(payload: RegisterRequest): Promise<AuthResponse> {
    return firstValueFrom(
      this.http
        .post<AuthResponse>(`${API_URL}/auth/register`, payload, { withCredentials: true })
        .pipe(tap((response) => this.applyAuthResponse(response)))
    );
  }

  login(payload: LoginRequest): Promise<AuthResponse> {
    return firstValueFrom(
      this.http
        .post<AuthResponse>(`${API_URL}/auth/login`, payload, { withCredentials: true })
        .pipe(tap((response) => this.applyAuthResponse(response)))
    );
  }

  refresh(): Promise<AuthResponse> {
    if (!this.refreshPromise) {
      const refreshSessionVersion = this.sessionVersion;
      this.refreshPromise = firstValueFrom(
        this.http
          .post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
          .pipe(tap((response) => this.applyAuthResponse(response, refreshSessionVersion)))
      ).finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true })
      );
    } catch {
      return;
    } finally {
      this.clearSessionState();
    }
  }

  me(): Promise<AuthUser> {
    return firstValueFrom(
      this.http
        .get<AuthUser>(`${API_URL}/auth/me`, { withCredentials: true })
        .pipe(tap((user) => this.applyUser(user)))
    );
  }

  updatePreferences(payload: UpdatePreferencesRequest): Promise<AuthUser> {
    return firstValueFrom(
      this.http
        .patch<AuthUser>(`${API_URL}/auth/me/preferences`, payload, { withCredentials: true })
        .pipe(tap((user) => this.applyUser(user)))
    );
  }

  private applyAuthResponse(response: AuthResponse, expectedSessionVersion = this.sessionVersion): void {
    if (expectedSessionVersion !== this.sessionVersion) {
      return;
    }
    this.accessToken = response.accessToken;
    this.applyUser(response.user);
  }

  private applyUser(user: AuthUser): void {
    this.user.set(user);
    this.localeService.applyUserLocale(user.locale);
  }

  private clearSessionState(): void {
    this.sessionVersion += 1;
    this.accessToken = null;
    this.refreshPromise = null;
    this.user.set(null);
    this.organizationService.clearSessionContext();
    this.clearPrivateStorage(localStorage);
    this.clearPrivateStorage(sessionStorage);
  }

  private clearPrivateStorage(storage: Storage): void {
    const keysToRemove: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && this.isPrivateSessionStorageKey(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => storage.removeItem(key));
  }

  private isPrivateSessionStorageKey(key: string): boolean {
    return PRIVATE_STORAGE_KEYS.has(key) || PRIVATE_STORAGE_PREFIXES.some((prefix) => key.startsWith(prefix));
  }
}
