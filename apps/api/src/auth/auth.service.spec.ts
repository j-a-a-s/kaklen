import {
  ConflictException,
  ExecutionContext,
  HttpException,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  EmailVerificationToken,
  Prisma,
  RefreshToken,
  User,
  UserStatus
} from "@prisma/client";
import * as argon2 from "argon2";
import { DUMMY_PASSWORD_HASH, AuthService, verifyLoginPassword } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedRequest } from "./auth.types";
import { MailDeliveryError, type EmailVerificationRequest } from "../notifications/mail.service";

type StoredRefreshToken = RefreshToken & { user?: User };
type StoredVerificationToken = EmailVerificationToken & { user?: User };

class FakePrismaService {
  private users: User[] = [];
  private refreshTokens: RefreshToken[] = [];
  private verificationTokens: EmailVerificationToken[] = [];
  private auditEvents: string[] = [];

  readonly user = {
    create: async ({ data }: { data: Prisma.UserCreateInput }): Promise<User> => {
      if (this.users.some((user) => user.email === data.email)) {
        throw new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test"
        });
      }
      const now = new Date();
      const user: User = {
        id: `user-${this.users.length + 1}`,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordHash: data.passwordHash,
        authVersion: 0,
        locale: typeof data.locale === "string" ? data.locale : "es",
        status: UserStatus.ACTIVE,
        emailVerifiedAt: data.emailVerifiedAt instanceof Date ? data.emailVerifiedAt : null,
        createdAt: now,
        updatedAt: now
      };
      this.users.push(user);
      return user;
    },
    findUnique: async ({ where }: { where: Prisma.UserWhereUniqueInput }): Promise<User | null> =>
      this.users.find((user) => user.email === where.email || user.id === where.id) ?? null,
    findFirst: async ({ where }: { where: Prisma.UserWhereInput }): Promise<User | null> =>
      this.users.find((user) => {
        const idMatches = !where.id || where.id === user.id;
        const statusMatches = !where.status || where.status === user.status;
        const verifiedMatches = !where.emailVerifiedAt || user.emailVerifiedAt !== null;
        return idMatches && statusMatches && verifiedMatches;
      }) ?? null,
    update: async ({
      where,
      data
    }: {
      where: Prisma.UserWhereUniqueInput;
      data: Prisma.UserUpdateInput;
    }): Promise<User> => {
      const user = this.users.find((item) => item.id === where.id);
      if (!user) throw new Error("User not found");
      if (typeof data.locale === "string") user.locale = data.locale;
      if (data.emailVerifiedAt instanceof Date) user.emailVerifiedAt = data.emailVerifiedAt;
      user.updatedAt = new Date();
      return user;
    }
  };

  readonly emailVerificationToken = {
    create: async ({
      data
    }: {
      data: Prisma.EmailVerificationTokenUncheckedCreateInput;
    }): Promise<EmailVerificationToken> => {
      const token: EmailVerificationToken = {
        id: `verification-${this.verificationTokens.length + 1}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        usedAt: null,
        revokedAt: null,
        sentAt: null,
        createdAt: new Date()
      };
      this.verificationTokens.push(token);
      return token;
    },
    findUnique: async ({
      where
    }: {
      where: Prisma.EmailVerificationTokenWhereUniqueInput;
    }): Promise<StoredVerificationToken | null> => {
      const token = this.verificationTokens.find(
        (item) => item.id === where.id || item.tokenHash === where.tokenHash
      );
      if (!token) return null;
      return { ...token, user: this.users.find((user) => user.id === token.userId) };
    },
    updateMany: async ({
      where,
      data
    }: {
      where: Prisma.EmailVerificationTokenWhereInput;
      data: Prisma.EmailVerificationTokenUpdateManyMutationInput;
    }): Promise<{ count: number }> => {
      const matches = this.verificationTokens.filter((token) => {
        if (where.id && typeof where.id === "string" && token.id !== where.id) return false;
        if (where.id && typeof where.id === "object" && "not" in where.id && token.id === where.id.not) return false;
        if (where.userId && token.userId !== where.userId) return false;
        if (where.sentAt === null && token.sentAt !== null) return false;
        if (where.sentAt && typeof where.sentAt === "object" && "not" in where.sentAt && token.sentAt === null) return false;
        if (where.usedAt === null && token.usedAt !== null) return false;
        if (where.revokedAt === null && token.revokedAt !== null) return false;
        if (where.expiresAt && typeof where.expiresAt === "object" && "gt" in where.expiresAt && where.expiresAt.gt instanceof Date && token.expiresAt <= where.expiresAt.gt) return false;
        return true;
      });
      for (const token of matches) {
        if (data.sentAt instanceof Date) token.sentAt = data.sentAt;
        if (data.usedAt instanceof Date) token.usedAt = data.usedAt;
        if (data.revokedAt instanceof Date) token.revokedAt = data.revokedAt;
      }
      return { count: matches.length };
    }
  };

  readonly refreshToken = {
    create: async ({ data }: { data: Prisma.RefreshTokenUncheckedCreateInput }): Promise<RefreshToken> => {
      const refreshToken: RefreshToken = {
        id: `refresh-${this.refreshTokens.length + 1}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        revokedAt: null,
        createdAt: new Date()
      };
      this.refreshTokens.push(refreshToken);
      return refreshToken;
    },
    findMany: async (): Promise<StoredRefreshToken[]> => {
      const now = Date.now();
      return this.refreshTokens
        .filter((token) => token.revokedAt === null && token.expiresAt.getTime() > now)
        .map((token) => ({
          ...token,
          user: this.users.find(
            (user) =>
              user.id === token.userId &&
              user.status === UserStatus.ACTIVE &&
              user.emailVerifiedAt !== null
          )
        }))
        .filter((token): token is StoredRefreshToken & { user: User } => Boolean(token.user));
    },
    update: async ({
      where,
      data
    }: {
      where: Prisma.RefreshTokenWhereUniqueInput;
      data: Prisma.RefreshTokenUpdateInput;
    }): Promise<RefreshToken> => {
      const token = this.refreshTokens.find((item) => item.id === where.id);
      if (!token) throw new Error("Refresh token not found");
      token.revokedAt = data.revokedAt instanceof Date ? data.revokedAt : new Date();
      return token;
    }
  };

  readonly authAuditLog = {
    create: async ({ data }: { data: Prisma.AuthAuditLogUncheckedCreateInput }) => {
      this.auditEvents.push(data.event);
      return { ...data, id: `audit-${this.auditEvents.length}`, createdAt: new Date() };
    }
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }

  latestVerificationToken(): EmailVerificationToken | null {
    return this.verificationTokens.at(-1) ?? null;
  }

  verificationTokensForUser(userId: string): EmailVerificationToken[] {
    return this.verificationTokens.filter((token) => token.userId === userId);
  }

  refreshTokenCount(): number {
    return this.refreshTokens.length;
  }

  async findRefreshTokenByPlainValue(refreshToken: string): Promise<RefreshToken | null> {
    for (const storedToken of this.refreshTokens) {
      if (await argon2.verify(storedToken.tokenHash, refreshToken)) return storedToken;
    }
    return null;
  }

  setUserStatus(email: string, status: UserStatus): void {
    const user = this.users.find((item) => item.email === email);
    if (user) user.status = status;
  }

  setUserPasswordHash(email: string, passwordHash: string): void {
    const user = this.users.find((item) => item.email === email);
    if (user) user.passwordHash = passwordHash;
  }

  expireLatestVerificationToken(): void {
    const token = this.latestVerificationToken();
    if (token) token.expiresAt = new Date(Date.now() - 1000);
  }

  revokeLatestVerificationToken(): void {
    const token = this.latestVerificationToken();
    if (token) token.revokedAt = new Date();
  }

  expireRefreshTokens(): void {
    this.refreshTokens.forEach((token) => {
      token.expiresAt = new Date(Date.now() - 1000);
    });
  }

  revokedRefreshTokenCount(): number {
    return this.refreshTokens.filter((token) => token.revokedAt !== null).length;
  }
}

describe("AuthService", () => {
  let prisma: FakePrismaService;
  let service: AuthService;
  let mailRequests: EmailVerificationRequest[];
  let mailService: ReturnType<typeof createMailService>;
  let authRateLimits: ReturnType<typeof createAuthRateLimits>;
  let authDeliveryQueue: ReturnType<typeof createAuthDeliveryQueue>;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough";
    process.env.JWT_ACCESS_EXPIRES_SECONDS = "900";
    process.env.JWT_REFRESH_EXPIRES_SECONDS = "604800";
    mailRequests = [];
    mailService = createMailService(mailRequests);
    authRateLimits = createAuthRateLimits();
    authDeliveryQueue = createAuthDeliveryQueue();
    prisma = new FakePrismaService();
    service = new AuthService(
      prisma as unknown as ConstructorParameters<typeof AuthService>[0],
      new JwtService(),
      mailService as unknown as ConstructorParameters<typeof AuthService>[2],
      authRateLimits as unknown as ConstructorParameters<typeof AuthService>[3],
      authDeliveryQueue as unknown as ConstructorParameters<typeof AuthService>[4]
    );
  });

  it("registers a pending user without issuing a session and stores only a token hash", async () => {
    const result = await service.register(registerDto(), requestContext());
    const token = rawTokenFrom(mailRequests[0]);
    const stored = prisma.latestVerificationToken();

    expect(result).toEqual({ message: "Cuenta creada. Revisa tu correo para confirmar tu dirección." });
    expect(result).not.toHaveProperty("accessToken");
    expect(result).not.toHaveProperty("refreshToken");
    expect(prisma.refreshTokenCount()).toBe(0);
    expect(stored?.sentAt).toBeInstanceOf(Date);
    expect(stored?.tokenHash).not.toBe(token);
    expect(JSON.stringify(stored)).not.toContain(token);
    expect(mailService.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("keeps the account pending and revokes the token when SMTP fails", async () => {
    mailService.sendEmailVerification.mockRejectedValueOnce(
      new MailDeliveryError("ECONNREFUSED", "connection", "SMTP unavailable")
    );

    await expect(service.register(registerDto(), requestContext())).resolves.toEqual({
      message: "Cuenta creada. Revisa tu correo para confirmar tu dirección."
    });
    expect(prisma.latestVerificationToken()).toMatchObject({
      sentAt: null,
      revokedAt: expect.any(Date)
    });
    expect(prisma.refreshTokenCount()).toBe(0);
  });

  it("rejects duplicate email registration", async () => {
    await service.register(registerDto(), requestContext());
    await expect(service.register(registerDto(), requestContext())).rejects.toBeInstanceOf(ConflictException);
  });

  it("blocks login until email confirmation without creating tokens", async () => {
    await service.register(registerDto(), requestContext());

    await expect(service.login(loginDto(), requestContext())).rejects.toMatchObject({
      status: 403,
      response: expect.objectContaining({ code: "EMAIL_NOT_VERIFIED" })
    });
    expect(prisma.refreshTokenCount()).toBe(0);
  });

  it("confirms a valid single-use token without starting a session, then permits login", async () => {
    await service.register(registerDto(), requestContext());
    const token = rawTokenFrom(mailRequests[0]);

    await expect(service.verifyEmail({ token }, requestContext())).resolves.toEqual({
      message: "Tu correo fue confirmado correctamente."
    });
    expect(prisma.refreshTokenCount()).toBe(0);

    const login = await service.login(loginDto(), requestContext());
    expect(login.accessToken).toEqual(expect.any(String));
    expect(login.user.emailVerifiedAt).toEqual(expect.any(String));
  });

  it.each([
    ["expired", () => prisma.expireLatestVerificationToken(), "EMAIL_VERIFICATION_TOKEN_EXPIRED"],
    ["revoked", () => prisma.revokeLatestVerificationToken(), "EMAIL_VERIFICATION_TOKEN_REVOKED"]
  ])("rejects an %s verification token", async (_label, mutate, expectedCode) => {
    await service.register(registerDto(), requestContext());
    const token = rawTokenFrom(mailRequests[0]);
    mutate();

    await expect(service.verifyEmail({ token }, requestContext())).rejects.toMatchObject({
      response: expect.objectContaining({ code: expectedCode })
    });
  });

  it("rejects used and invalid verification tokens", async () => {
    await service.register(registerDto(), requestContext());
    const token = rawTokenFrom(mailRequests[0]);
    await service.verifyEmail({ token }, requestContext());

    await expect(service.verifyEmail({ token }, requestContext())).rejects.toBeInstanceOf(HttpException);
    await expect(
      service.verifyEmail({ token: "x".repeat(48) }, requestContext())
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "EMAIL_VERIFICATION_TOKEN_INVALID" })
    });
  });

  it("enqueues a resend without waiting for SMTP", async () => {
    await service.register(registerDto(), requestContext());

    await expect(
      service.resendVerificationEmail({ email: "ada@example.com" }, requestContext())
    ).resolves.toEqual({
      message: "Si la cuenta requiere confirmación, enviaremos un nuevo correo."
    });

    expect(authDeliveryQueue.enqueueVerificationResend).toHaveBeenCalledWith(
      "ada@example.com",
      requestContext()
    );
    expect(mailService.sendEmailVerification).toHaveBeenCalledTimes(1);
  });

  it("returns the same response before account eligibility is evaluated by the worker", async () => {
    await registerAndVerify(service, mailRequests);
    const confirmed = await service.resendVerificationEmail(
      { email: "ada@example.com" },
      requestContext()
    );
    const missing = await service.resendVerificationEmail(
      { email: "missing@example.com" },
      requestContext()
    );

    expect(confirmed).toEqual(missing);
    expect(authDeliveryQueue.enqueueVerificationResend).toHaveBeenCalledTimes(2);
  });

  it("keeps generic responses and enqueues nothing when recovery limits are exceeded", async () => {
    authRateLimits.allowForgotPassword.mockResolvedValueOnce(false);
    authRateLimits.allowVerificationResend.mockResolvedValueOnce(false);

    await expect(
      service.forgotPassword({ email: "ada@example.com" }, requestContext())
    ).resolves.toEqual({
      message: "Si existe una cuenta asociada, enviaremos instrucciones para recuperar el acceso."
    });
    await expect(
      service.resendVerificationEmail({ email: "ada@example.com" }, requestContext())
    ).resolves.toEqual({
      message: "Si la cuenta requiere confirmación, enviaremos un nuevo correo."
    });
    expect(authDeliveryQueue.enqueuePasswordReset).not.toHaveBeenCalled();
    expect(authDeliveryQueue.enqueueVerificationResend).not.toHaveBeenCalled();
  });

  it("rejects invalid credentials and inactive users with a generic error", async () => {
    await service.register(registerDto(), requestContext());
    const wrongPassword = service.login(
      { ...loginDto(), password: "wrong-password" },
      requestContext()
    );
    const missingUser = service.login(
      { email: "missing@example.com", password: "wrong-password" },
      requestContext()
    );
    await expect(wrongPassword).rejects.toMatchObject({
      response: { error: "Unauthorized", message: "Invalid credentials", statusCode: 401 }
    });
    await expect(missingUser).rejects.toMatchObject({
      response: { error: "Unauthorized", message: "Invalid credentials", statusCode: 401 }
    });
    await expect(
      service.login({ ...loginDto(), password: "wrong-password" }, requestContext())
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.verifyEmail({ token: rawTokenFrom(mailRequests[0]) }, requestContext());
    prisma.setUserStatus("ada@example.com", UserStatus.INACTIVE);
    await expect(service.login(loginDto(), requestContext())).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("runs Argon2 against the precomputed dummy hash for a missing account", async () => {
    const verify = jest.fn(async () => false);

    await expect(verifyLoginPassword(null, "wrong-password", verify)).resolves.toBe(false);

    expect(verify).toHaveBeenCalledWith(DUMMY_PASSWORD_HASH, "wrong-password");
  });

  it("runs Argon2 against the stored hash for an incorrect password", async () => {
    const verify = jest.fn(async () => false);

    await expect(
      verifyLoginPassword({ passwordHash: "stored-argon2-hash" }, "wrong-password", verify)
    ).resolves.toBe(false);

    expect(verify).toHaveBeenCalledWith("stored-argon2-hash", "wrong-password");
  });

  it("uses the dummy hash after a malformed persisted hash", async () => {
    const verify = jest
      .fn<Promise<boolean>, [string, string]>()
      .mockRejectedValueOnce(new Error("Invalid Argon2 hash"))
      .mockResolvedValueOnce(false);

    await expect(
      verifyLoginPassword({ passwordHash: "malformed-hash" }, "wrong-password", verify)
    ).resolves.toBe(false);

    expect(verify.mock.calls).toEqual([
      ["malformed-hash", "wrong-password"],
      [DUMMY_PASSWORD_HASH, "wrong-password"]
    ]);
  });

  it("returns the same generic 401 for a malformed persisted password hash", async () => {
    await registerAndVerify(service, mailRequests);
    prisma.setUserPasswordHash("ada@example.com", "malformed-hash");

    await expect(service.login(loginDto(), requestContext())).rejects.toMatchObject({
      response: { error: "Unauthorized", message: "Invalid credentials", statusCode: 401 }
    });
  });

  it("rotates valid refresh tokens and rejects expired or revoked tokens", async () => {
    await registerAndVerify(service, mailRequests);
    const loggedIn = await service.login(loginDto(), requestContext());
    const refreshed = await service.refresh(loggedIn.refreshToken);
    const oldToken = await prisma.findRefreshTokenByPlainValue(loggedIn.refreshToken);

    expect(refreshed.accessToken).toEqual(expect.any(String));
    expect(oldToken?.revokedAt).toBeInstanceOf(Date);
    await expect(service.refresh(loggedIn.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    prisma.expireRefreshTokens();
    await expect(service.refresh(refreshed.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("treats logout without a matching refresh token as idempotent", async () => {
    await service.logout(undefined);
    await service.logout("not-a-stored-token");
    expect(prisma.revokedRefreshTokenCount()).toBe(0);
  });

  it("requires a verified active user for me and preference updates", async () => {
    await service.register(registerDto(), requestContext());
    await expect(service.me("user-1")).rejects.toBeInstanceOf(UnauthorizedException);
    await service.verifyEmail({ token: rawTokenFrom(mailRequests[0]) }, requestContext());

    const updated = await service.updatePreferences("user-1", { locale: "pt-BR" });
    expect(updated.locale).toBe("pt-BR");
  });
});

describe("JwtAuthGuard", () => {
  it("protects authenticated endpoints when the access token is missing", async () => {
    const guard = new JwtAuthGuard(
      new JwtService(),
      new FakePrismaService() as unknown as ConstructorParameters<typeof JwtAuthGuard>[1]
    );
    const request = { headers: {} } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({ getRequest: () => request })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

function createMailService(requests: EmailVerificationRequest[]) {
  return {
    getEmailVerificationPolicy: jest.fn(() => ({
      appPublicUrl: "http://localhost:4200",
      expiresMinutes: 1440
    })),
    getPasswordResetPolicy: jest.fn(() => ({
      appPublicUrl: "http://localhost:4200",
      expiresMinutes: 30
    })),
    sendEmailVerification: jest.fn(async (request: EmailVerificationRequest) => {
      requests.push(request);
      return {
        recipient: request.recipient,
        messageId: "<verification@test>",
        accepted: [request.recipient],
        rejected: []
      };
    }),
    sendPasswordResetEmail: jest.fn()
  };
}

async function registerAndVerify(
  service: AuthService,
  requests: EmailVerificationRequest[]
): Promise<void> {
  await service.register(registerDto(), requestContext());
  await service.verifyEmail({ token: rawTokenFrom(requests.at(-1)) }, requestContext());
}

function createAuthRateLimits() {
  return {
    assertRegisterAllowed: jest.fn(async () => undefined),
    assertLoginAllowed: jest.fn(async () => undefined),
    allowForgotPassword: jest.fn(async () => true),
    assertResetPasswordAllowed: jest.fn(async () => undefined),
    allowVerificationResend: jest.fn(async () => true),
    assertEmailVerificationAllowed: jest.fn(async () => undefined)
  };
}

function createAuthDeliveryQueue() {
  return {
    enqueuePasswordReset: jest.fn(async () => undefined),
    enqueueVerificationResend: jest.fn(async () => undefined)
  };
}

function rawTokenFrom(request: EmailVerificationRequest | undefined): string {
  if (!request) throw new Error("Verification email was not requested");
  const token = new URL(request.verificationUrl).searchParams.get("token");
  if (!token) throw new Error("Verification token is missing");
  return token;
}

function registerDto() {
  return {
    email: "Ada@Example.com",
    firstName: "Ada",
    lastName: "Lovelace",
    password: "correct-password",
    locale: "es" as const
  };
}

function loginDto() {
  return { email: "ada@example.com", password: "correct-password" };
}

function requestContext() {
  return { ipAddress: "127.0.0.1", userAgent: "Jest", requestId: "request-1" };
}
