import { HttpClient } from "@angular/common/http";
import { Injectable, signal } from "@angular/core";
import { firstValueFrom, tap } from "rxjs";
import { AuthResponse, AuthUser, LoginRequest, RegisterRequest } from "./auth.models";

const API_URL = "http://localhost:3000/api";

@Injectable({ providedIn: "root" })
export class AuthService {
  readonly user = signal<AuthUser | null>(null);
  private accessToken: string | null = null;
  private refreshPromise: Promise<AuthResponse> | null = null;

  constructor(private readonly http: HttpClient) {}

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
        .pipe(tap((user) => this.user.set(user)))
    );
  }

  private applyAuthResponse(response: AuthResponse): void {
    this.accessToken = response.accessToken;
    this.user.set(response.user);
  }
}
