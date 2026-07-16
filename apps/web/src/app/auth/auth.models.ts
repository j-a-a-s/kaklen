export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  locale: string;
  status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  firstName: string;
  lastName: string;
  locale: "es" | "en" | "pt-BR";
}

export interface VerifyEmailRequest {
  token: string;
}

export interface ResendVerificationEmailRequest {
  email: string;
}

export interface UpdatePreferencesRequest {
  locale: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  password: string;
  confirmPassword: string;
}

export interface MessageResponse {
  message: string;
}
