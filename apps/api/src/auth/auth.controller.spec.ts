import { ForbiddenException } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import { AuthController } from "./auth.controller";

describe("AuthController", () => {
  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough";
    process.env.JWT_ACCESS_EXPIRES_SECONDS = "900";
    process.env.JWT_REFRESH_EXPIRES_SECONDS = "604800";
    process.env.COOKIE_SECURE = "false";
    process.env.AUTH_ALLOWED_ORIGINS = "http://localhost:4200";
  });

  it("registers without a cookie and sets HttpOnly refresh cookies only for login and refresh", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const response = makeResponse();

    await expect(
      controller.register(
        { email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", password: "secret" },
        { ip: "127.0.0.1", socket: {}, headers: {} } as never
      )
    ).resolves.toEqual({ message: "account pending" });
    expect(response.cookie).not.toHaveBeenCalled();
    await controller.login({ email: "ada@example.com", password: "secret" }, response as never);
    await controller.refresh({ cookies: { kaklen_refresh_token: "refresh-token" }, headers: { origin: "http://localhost:4200" } } as never, response as never);

    expect(response.cookie).toHaveBeenCalledWith(
      "kaklen_refresh_token",
      "refresh-token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/auth", secure: false })
    );
  });

  it("delegates verification and resend with request context", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const request = {
      ip: "127.0.0.1",
      socket: {},
      headers: { "user-agent": "Jest" },
      requestId: "request-1"
    };

    await expect(controller.verifyEmail({ token: "x".repeat(48) })).resolves.toEqual({
      message: "email verified"
    });
    await expect(
      controller.resendVerificationEmail({ email: "ada@example.com" }, request as never)
    ).resolves.toEqual({ message: "generic verification response" });
    expect(service.resendVerificationEmail).toHaveBeenCalledWith(
      { email: "ada@example.com" },
      { ipAddress: "127.0.0.1", userAgent: "Jest", requestId: "request-1" }
    );
  });

  it("rejects refresh and logout from disallowed origins", async () => {
    const controller = new AuthController(makeAuthService() as never);
    const request = { cookies: { kaklen_refresh_token: "refresh-token" }, headers: { origin: "https://evil.example" } };

    await expect(controller.refresh(request as never, makeResponse() as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(controller.logout(request as never, makeResponse() as never)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("logs out, clears the cookie, and supports missing Origin", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const response = makeResponse();

    await expect(controller.logout({ cookies: { kaklen_refresh_token: "refresh-token" }, headers: {} } as never, response as never)).resolves.toEqual({
      message: "Logged out"
    });

    expect(service.logout).toHaveBeenCalledWith("refresh-token");
    expect(response.clearCookie).toHaveBeenCalledWith(
      "kaklen_refresh_token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/auth", secure: false })
    );
  });

  it("delegates me and user preference updates to AuthService", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const request = { user: { sub: "user-1" } };

    await expect(controller.me(request as never)).resolves.toMatchObject({ id: "user-1" });
    await expect(controller.updatePreferences(request as never, { locale: "pt-BR" })).resolves.toMatchObject({ locale: "pt-BR" });
    expect(service.updatePreferences).toHaveBeenCalledWith("user-1", { locale: "pt-BR" });
  });

  it("delegates password recovery without exposing request details in the response", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const request = {
      ip: "127.0.0.1",
      socket: {},
      headers: { "user-agent": "Jest" }
    };

    await expect(
      controller.forgotPassword({ email: "ada@example.com" }, request as never)
    ).resolves.toEqual({ message: "generic recovery response" });
    await expect(
      controller.resetPassword(
        { token: "reset-token", password: "UpdatedPass456!", confirmPassword: "UpdatedPass456!" },
        request as never
      )
    ).resolves.toEqual({ message: "password updated" });
    expect(service.forgotPassword).toHaveBeenCalledWith(
      { email: "ada@example.com" },
      { ipAddress: "127.0.0.1", userAgent: "Jest" }
    );
  });
});

function makeAuthService() {
  const user = {
    id: "user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    locale: "es",
    status: UserStatus.ACTIVE,
    emailVerifiedAt: "2026-07-15T00:00:00.000Z",
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z"
  };
  return {
    register: jest.fn(async () => ({ message: "account pending" })),
    login: jest.fn(async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" })),
    verifyEmail: jest.fn(async () => ({ message: "email verified" })),
    resendVerificationEmail: jest.fn(async () => ({ message: "generic verification response" })),
    refresh: jest.fn(async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" })),
    forgotPassword: jest.fn(async () => ({ message: "generic recovery response" })),
    resetPassword: jest.fn(async () => ({ message: "password updated" })),
    logout: jest.fn(async () => undefined),
    me: jest.fn(async () => user),
    updatePreferences: jest.fn(async () => ({ ...user, locale: "pt-BR" }))
  };
}

function makeResponse() {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn()
  };
}
