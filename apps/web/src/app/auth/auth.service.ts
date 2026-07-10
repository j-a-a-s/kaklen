import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { firstValueFrom, tap } from "rxjs";
import { API_BASE_URL } from "../config/runtime-config";
import { LocaleService } from "../i18n/locale.service";
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest, UpdatePreferencesRequest } from "./auth.models";

const API_URL = API_BASE_URL;

@Injectable({ providedIn: "root" })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  private accessToken: string | null = null;
  private refreshPromise: Promise<AuthResponse> | null = null;

  constructor(
    private readonly http: HttpClient,
    private readonly localeService: LocaleService
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
      this.refreshPromise = firstValueFrom(
        this.http
          .post<AuthResponse>(`${API_URL}/auth/refresh`, {}, { withCredentials: true })
          .pipe(tap((response) => this.applyAuthResponse(response)))
      ).finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post(`${API_URL}/auth/logout`, {}, { withCredentials: true })
    ).catch(() => undefined);
    this.accessToken = null;
    this.user.set(null);
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

  private applyAuthResponse(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.applyUser(response.user);
  }

  private applyUser(user: AuthUser): void {
    this.user.set(user);
    this.localeService.applyUserLocale(user.locale);
  }
}
