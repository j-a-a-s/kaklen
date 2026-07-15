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

  it("sets HttpOnly refresh cookies for register, login, and refresh", async () => {
    const service = makeAuthService();
    const controller = new AuthController(service as never);
    const response = makeResponse();

    await expect(controller.register({ email: "ada@example.com", firstName: "Ada", lastName: "Lovelace", password: "secret" }, response as never)).resolves.toMatchObject({
      accessToken: "access-token"
    });
    await controller.login({ email: "ada@example.com", password: "secret" }, response as never);
    await controller.refresh({ cookies: { kaklen_refresh_token: "refresh-token" }, headers: { origin: "http://localhost:4200" } } as never, response as never);

    expect(response.cookie).toHaveBeenCalledWith(
      "kaklen_refresh_token",
      "refresh-token",
      expect.objectContaining({ httpOnly: true, sameSite: "lax", path: "/api/auth", secure: false })
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
});

function makeAuthService() {
  const user = {
    id: "user-1",
    email: "ada@example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    locale: "es",
    status: UserStatus.ACTIVE,
    createdAt: "2026-07-15T00:00:00.000Z",
    updatedAt: "2026-07-15T00:00:00.000Z"
  };
  return {
    register: jest.fn(async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" })),
    login: jest.fn(async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" })),
    refresh: jest.fn(async () => ({ user, accessToken: "access-token", refreshToken: "refresh-token" })),
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
