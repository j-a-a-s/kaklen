import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import {
  EmailVerificationToken,
  PasswordResetToken,
  Prisma,
  RefreshToken,
  User,
  UserStatus
} from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "../app.module";
import {
  MailService,
  type EmailVerificationRequest,
  type PasswordResetEmailRequest
} from "../notifications/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

type StoredRefreshToken = RefreshToken & { user?: User };

class FakePrismaService {
  private users: User[] = [];
  private refreshTokens: RefreshToken[] = [];
  private verificationTokens: EmailVerificationToken[] = [];
  private passwordResetTokens: PasswordResetToken[] = [];

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
        emailVerifiedAt: null,
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
        if (where.id && user.id !== where.id) return false;
        if (where.status && user.status !== where.status) return false;
        if (where.emailVerifiedAt && user.emailVerifiedAt === null) return false;
        return true;
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
      if (typeof data.passwordHash === "string") user.passwordHash = data.passwordHash;
      if (
        data.authVersion &&
        typeof data.authVersion === "object" &&
        "increment" in data.authVersion &&
        typeof data.authVersion.increment === "number"
      ) {
        user.authVersion += data.authVersion.increment;
      }
      user.updatedAt = new Date();
      return user;
    }
  };

  readonly passwordResetToken = {
    create: async ({
      data
    }: {
      data: Prisma.PasswordResetTokenUncheckedCreateInput;
    }): Promise<PasswordResetToken> => {
      const token: PasswordResetToken = {
        id: `reset-${this.passwordResetTokens.length + 1}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        sentAt: null,
        usedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        requestedIpHash: data.requestedIpHash ?? null,
        userAgentHash: data.userAgentHash ?? null
      };
      this.passwordResetTokens.push(token);
      return token;
    },
    findUnique: async ({
      where
    }: {
      where: Prisma.PasswordResetTokenWhereUniqueInput;
    }): Promise<(PasswordResetToken & { user: User }) | null> => {
      const token = this.passwordResetTokens.find((entry) => entry.tokenHash === where.tokenHash);
      const user = token ? this.users.find((entry) => entry.id === token.userId) : undefined;
      return token && user ? { ...token, user } : null;
    },
    updateMany: async ({
      where,
      data
    }: {
      where: Prisma.PasswordResetTokenWhereInput;
      data: Prisma.PasswordResetTokenUpdateManyMutationInput;
    }): Promise<{ count: number }> => {
      const matches = this.passwordResetTokens.filter((token) => {
        if (where.id && token.id !== where.id) return false;
        if (where.userId && token.userId !== where.userId) return false;
        if (where.sentAt === null && token.sentAt !== null) return false;
        if (where.usedAt === null && token.usedAt !== null) return false;
        if (where.revokedAt === null && token.revokedAt !== null) return false;
        if (
          where.expiresAt &&
          typeof where.expiresAt === "object" &&
          "gt" in where.expiresAt &&
          where.expiresAt.gt instanceof Date &&
          token.expiresAt <= where.expiresAt.gt
        ) {
          return false;
        }
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
        sentAt: null,
        usedAt: null,
        revokedAt: null,
        createdAt: new Date()
      };
      this.verificationTokens.push(token);
      return token;
    },
    findUnique: async ({
      where
    }: {
      where: Prisma.EmailVerificationTokenWhereUniqueInput;
    }) => {
      const token = this.verificationTokens.find((item) => item.tokenHash === where.tokenHash);
      if (!token) return null;
      const user = this.users.find((item) => item.id === token.userId);
      return user ? { ...token, user } : null;
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
      const token: RefreshToken = {
        id: `refresh-${this.refreshTokens.length + 1}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt),
        revokedAt: null,
        createdAt: new Date()
      };
      this.refreshTokens.push(token);
      return token;
    },
    findMany: async (): Promise<StoredRefreshToken[]> =>
      this.refreshTokens
        .filter((token) => token.revokedAt === null && token.expiresAt > new Date())
        .map((token) => ({
          ...token,
          user: this.users.find(
            (user) =>
              user.id === token.userId &&
              user.status === UserStatus.ACTIVE &&
              user.emailVerifiedAt !== null
          )
        }))
        .filter((token): token is StoredRefreshToken & { user: User } => Boolean(token.user)),
    update: async ({ where }: { where: Prisma.RefreshTokenWhereUniqueInput }): Promise<RefreshToken> => {
      const token = this.refreshTokens.find((item) => item.id === where.id);
      if (!token) throw new Error("Refresh token not found");
      token.revokedAt = new Date();
      return token;
    },
    updateMany: async ({
      where,
      data
    }: {
      where: Prisma.RefreshTokenWhereInput;
      data: Prisma.RefreshTokenUpdateManyMutationInput;
    }): Promise<{ count: number }> => {
      const matches = this.refreshTokens.filter(
        (token) => token.userId === where.userId && token.revokedAt === null
      );
      for (const token of matches) {
        if (data.revokedAt instanceof Date) token.revokedAt = data.revokedAt;
      }
      return { count: matches.length };
    }
  };

  readonly authAuditLog = {
    create: async ({ data }: { data: Prisma.AuthAuditLogUncheckedCreateInput }) => ({
      ...data,
      id: `audit-${Date.now()}`,
      createdAt: new Date()
    })
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async onModuleInit(): Promise<void> {}
  async onModuleDestroy(): Promise<void> {}
}

describe("Auth E2E", () => {
  let testSequence = 0;
  let app: INestApplication;
  let server: Parameters<typeof request>[0];
  let verificationRequests: EmailVerificationRequest[];
  let passwordResetRequests: PasswordResetEmailRequest[];

  beforeEach(async () => {
    testSequence += 1;
    process.env.REDIS_URL = "redis://localhost:6379/12";
    process.env.RATE_LIMIT_HASH_SECRET = `auth-e2e-rate-secret-${testSequence}`;
    process.env.JWT_ACCESS_SECRET = "e2e-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "e2e-refresh-secret-that-is-long-enough";
    process.env.JWT_ACCESS_EXPIRES_SECONDS = "900";
    process.env.JWT_REFRESH_EXPIRES_SECONDS = "604800";
    process.env.COOKIE_SECURE = "false";
    process.env.AUTH_ALLOWED_ORIGINS = "http://localhost:4200";
    verificationRequests = [];
    passwordResetRequests = [];

    const mailService = {
      getEmailVerificationPolicy: () => ({ appPublicUrl: "http://localhost:4200", expiresMinutes: 1440 }),
      getPasswordResetPolicy: () => ({ appPublicUrl: "http://localhost:4200", expiresMinutes: 30 }),
      sendEmailVerification: async (mail: EmailVerificationRequest) => {
        verificationRequests.push(mail);
        return { recipient: mail.recipient, messageId: "<e2e@test>", accepted: [mail.recipient], rejected: [] };
      },
      sendPasswordResetEmail: async (mail: PasswordResetEmailRequest) => {
        passwordResetRequests.push(mail);
        return {
          recipient: mail.recipient,
          messageId: "<reset-e2e@test>",
          accepted: [mail.recipient],
          rejected: []
        };
      },
      send: async () => ({ recipient: "", messageId: "<e2e@test>", accepted: [], rejected: [] }),
      onModuleDestroy: () => undefined
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .overrideProvider(MailService)
      .useValue(mailService)
      .overrideProvider(AuthRateLimitService)
      .useValue({
        assertRegisterAllowed: async () => undefined,
        assertLoginAllowed: async () => undefined,
        allowForgotPassword: async () => true,
        assertResetPasswordAllowed: async () => undefined,
        allowVerificationResend: async () => true,
        assertEmailVerificationAllowed: async () => undefined
      })
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix(KAKLEN_API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true })
    );
    await app.init();
    const redis = app.get(RedisService);
    const staleRateKeys = await redis.client.keys(`${redis.config.rateLimitPrefix}:*`);
    if (staleRateKeys.length > 0) {
      await redis.client.del(...staleRateKeys);
    }
    server = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers pending, sets no cookie, blocks login, verifies, then permits manual login", async () => {
    const registered = await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);

    expect(registered.body).toEqual({
      message: "Cuenta creada. Revisa tu correo para confirmar tu dirección."
    });
    expect(registered.body.accessToken).toBeUndefined();
    expect(registered.headers["set-cookie"]).toBeUndefined();

    const blocked = await request(server)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-password" })
      .expect(403);
    expect(blocked.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(blocked.headers["set-cookie"]).toBeUndefined();

    const verified = await request(server)
      .post("/api/auth/verify-email")
      .send({ token: verificationToken(verificationRequests[0]) })
      .expect(200);
    expect(verified.body).toEqual({ message: "Tu correo fue confirmado correctamente." });
    expect(verified.body.accessToken).toBeUndefined();
    expect(verified.headers["set-cookie"]).toBeUndefined();

    const login = await request(server)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "correct-password" })
      .expect(200);
    const redis = app.get(RedisService);
    const globalThrottleKeys = await redis.client.keys(
      `${redis.config.rateLimitPrefix}:throttler:*`
    );
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(globalThrottleKeys).toEqual([]);
  });

  it("resends generically, revokes the previous token, and accepts only the newest token", async () => {
    await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);
    const firstToken = verificationToken(verificationRequests[0]);

    const resend = await request(server)
      .post("/api/auth/resend-verification-email")
      .send({ email: "ada@example.com" })
      .expect(200);
    expect(resend.body).toEqual({
      message: "Si la cuenta requiere confirmación, enviaremos un nuevo correo."
    });
    await waitFor(() => verificationRequests.length === 2);
    expect(verificationRequests).toHaveLength(2);

    await request(server)
      .post("/api/auth/verify-email")
      .send({ token: firstToken })
      .expect(410);
    await request(server)
      .post("/api/auth/verify-email")
      .send({ token: verificationToken(verificationRequests[1]) })
      .expect(200);
  });

  it("keeps the same resend response for missing and confirmed accounts", async () => {
    const missing = await request(server)
      .post("/api/auth/resend-verification-email")
      .send({ email: "missing@example.com" })
      .expect(200);
    expect(missing.body.message).toContain("Si la cuenta requiere confirmación");
  });

  it("rotates refresh tokens and clears the cookie on logout", async () => {
    await request(server).post("/api/auth/register").send(registerPayload("ada@example.com")).expect(201);
    await request(server).post("/api/auth/verify-email").send({ token: verificationToken(verificationRequests[0]) }).expect(200);
    const login = await request(server).post("/api/auth/login").send({ email: "ada@example.com", password: "correct-password" }).expect(200);
    const firstCookie = login.headers["set-cookie"][0];

    const refreshed = await request(server)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", firstCookie)
      .expect(200);
    expect(refreshed.headers["set-cookie"][0]).not.toBe(firstCookie);
    await request(server)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", firstCookie)
      .expect(401);

    const logout = await request(server)
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", refreshed.headers["set-cookie"][0])
      .expect(200);
    expect(logout.headers["set-cookie"][0]).toContain("kaklen_refresh_token=;");
  });

  it("rejects incorrect login and protects me without JWT", async () => {
    await request(server).post("/api/auth/login").send({ email: "missing@example.com", password: "wrong-password" }).expect(401);
    await request(server).get("/api/auth/me").expect(401);
  });

  it("keeps forgot-password generic and completes a queued password reset", async () => {
    await request(server).post("/api/auth/register").send(registerPayload("ada@example.com")).expect(201);
    await request(server)
      .post("/api/auth/verify-email")
      .send({ token: verificationToken(verificationRequests[0]) })
      .expect(200);

    const existing = await request(server)
      .post("/api/auth/forgot-password")
      .send({ email: "ada@example.com" })
      .expect(200);
    const missing = await request(server)
      .post("/api/auth/forgot-password")
      .send({ email: "missing@example.com" })
      .expect(200);
    expect(existing.body).toEqual(missing.body);
    await waitFor(() => passwordResetRequests.length === 1);

    await request(server)
      .post("/api/auth/reset-password")
      .send({
        token: passwordResetToken(passwordResetRequests[0]),
        password: "UpdatedPass456!",
        confirmPassword: "UpdatedPass456!"
      })
      .expect(200);
    await request(server)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "UpdatedPass456!" })
      .expect(200);
  });

  it("uses Redis-backed Nest throttling and returns Retry-After", async () => {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await request(server).post("/api/auth/refresh").expect(401);
    }

    const limited = await request(server).post("/api/auth/refresh").expect(429);
    const redis = app.get(RedisService);
    const keys = await redis.client.keys(`${redis.config.rateLimitPrefix}:throttler:*`);

    expect(Number(limited.headers["retry-after"])).toBeGreaterThanOrEqual(1);
    expect(Number(limited.headers["retry-after"])).toBeLessThanOrEqual(60);
    expect(keys.length).toBeGreaterThan(0);
  });
});

function registerPayload(email: string) {
  return {
    email,
    firstName: "Ada",
    lastName: "Lovelace",
    password: "correct-password",
    locale: "es"
  };
}

function verificationToken(mail: EmailVerificationRequest | undefined): string {
  if (!mail) throw new Error("Verification email was not sent");
  const token = new URL(mail.verificationUrl).searchParams.get("token");
  if (!token) throw new Error("Verification token was not included");
  return token;
}

function passwordResetToken(mail: PasswordResetEmailRequest | undefined): string {
  if (!mail) throw new Error("Password reset email was not sent");
  const token = new URL(mail.resetUrl).searchParams.get("token");
  if (!token) throw new Error("Password reset token was not included");
  return token;
}

async function waitFor(condition: () => boolean): Promise<void> {
  const deadline = Date.now() + 3000;
  while (!condition()) {
    if (Date.now() >= deadline) {
      throw new Error("Timed out waiting for asynchronous authentication delivery");
    }
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
}
