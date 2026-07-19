import { HttpException } from "@nestjs/common";
import { AuthAuditLog, PasswordResetToken, RefreshToken, User, UserStatus } from "@prisma/client";
import { createHash } from "node:crypto";
import { JwtService } from "@nestjs/jwt";
import * as argon2 from "argon2";
import { ERROR_CODES } from "../common/error-codes";
import {
  MailDeliveryError,
  type MailDeliveryReceipt,
  type PasswordResetEmailRequest
} from "../notifications/mail.service";
import { AuthService } from "./auth.service";
import { AuthDeliveryProcessor } from "./auth-delivery.processor";

interface TokenWhere {
  id?: string;
  userId?: string;
  usedAt?: null;
  revokedAt?: null;
  sentAt?: null;
  expiresAt?: { gt: Date };
}

class RecoveryPrisma {
  readonly users: User[] = [];
  readonly passwordResetTokens: PasswordResetToken[] = [];
  readonly refreshTokens: RefreshToken[] = [];
  readonly authAuditLogs: AuthAuditLog[] = [];

  readonly user = {
    findUnique: async ({ where }: { where: { email?: string; id?: string } }): Promise<User | null> =>
      this.users.find((user) => user.email === where.email || user.id === where.id) ?? null,
    update: async ({
      where,
      data
    }: {
      where: { id?: string };
      data: { passwordHash?: string; authVersion?: { increment: number }; locale?: string };
    }): Promise<User> => {
      const user = this.users.find((entry) => entry.id === where.id);
      if (!user) {
        throw new Error("User not found");
      }
      if (data.passwordHash) {
        user.passwordHash = data.passwordHash;
      }
      if (data.authVersion) {
        user.authVersion += data.authVersion.increment;
      }
      if (data.locale) {
        user.locale = data.locale;
      }
      user.updatedAt = new Date();
      return user;
    }
  };

  readonly passwordResetToken = {
    create: async ({
      data
    }: {
      data: Omit<PasswordResetToken, "id" | "createdAt" | "sentAt" | "usedAt" | "revokedAt">;
    }): Promise<PasswordResetToken> => {
      const token: PasswordResetToken = {
        id: `reset-${this.passwordResetTokens.length + 1}`,
        userId: data.userId,
        tokenHash: data.tokenHash,
        expiresAt: data.expiresAt,
        sentAt: null,
        usedAt: null,
        revokedAt: null,
        createdAt: new Date(),
        requestedIpHash: data.requestedIpHash,
        userAgentHash: data.userAgentHash
      };
      this.passwordResetTokens.push(token);
      return token;
    },
    findUnique: async ({ where }: { where: { tokenHash: string } }): Promise<(PasswordResetToken & { user: User }) | null> => {
      const token = this.passwordResetTokens.find((entry) => entry.tokenHash === where.tokenHash);
      const user = token ? this.users.find((entry) => entry.id === token.userId) : undefined;
      return token && user ? { ...token, user } : null;
    },
    updateMany: async ({
      where,
      data
    }: {
      where: TokenWhere;
      data: { sentAt?: Date; usedAt?: Date; revokedAt?: Date };
    }): Promise<{ count: number }> => {
      const matching = this.passwordResetTokens.filter((token) => this.matchesToken(token, where));
      matching.forEach((token) => {
        if (data.sentAt) {
          token.sentAt = data.sentAt;
        }
        if (data.usedAt) {
          token.usedAt = data.usedAt;
        }
        if (data.revokedAt) {
          token.revokedAt = data.revokedAt;
        }
      });
      return { count: matching.length };
    }
  };

  readonly refreshToken = {
    updateMany: async ({
      where,
      data
    }: {
      where: { userId: string; revokedAt: null };
      data: { revokedAt: Date };
    }): Promise<{ count: number }> => {
      const matching = this.refreshTokens.filter(
        (token) => token.userId === where.userId && token.revokedAt === null
      );
      matching.forEach((token) => {
        token.revokedAt = data.revokedAt;
      });
      return { count: matching.length };
    }
  };

  readonly authAuditLog = {
    create: async ({
      data
    }: {
      data: Omit<AuthAuditLog, "id" | "createdAt">;
    }): Promise<AuthAuditLog> => {
      const audit: AuthAuditLog = {
        id: `audit-${this.authAuditLogs.length + 1}`,
        userId: data.userId,
        event: data.event,
        success: data.success,
        metadata: data.metadata ?? null,
        createdAt: new Date()
      };
      this.authAuditLogs.push(audit);
      return audit;
    }
  };

  async $transaction<T>(callback: (transaction: RecoveryPrisma) => Promise<T>): Promise<T> {
    return callback(this);
  }

  private matchesToken(token: PasswordResetToken, where: TokenWhere): boolean {
    return (
      (!where.id || token.id === where.id) &&
      (!where.userId || token.userId === where.userId) &&
      (where.usedAt !== null || token.usedAt === null) &&
      (where.revokedAt !== null || token.revokedAt === null) &&
      (where.sentAt !== null || token.sentAt === null) &&
      (!where.expiresAt?.gt || token.expiresAt > where.expiresAt.gt)
    );
  }
}

describe("AuthService password recovery", () => {
  const context = { ipAddress: "127.0.0.1", userAgent: "Jest" };
  let prisma: RecoveryPrisma;
  let sentMessages: PasswordResetEmailRequest[];
  let sendPasswordResetEmail: jest.MockedFunction<
    (request: PasswordResetEmailRequest) => Promise<MailDeliveryReceipt>
  >;
  let service: AuthService;
  let processor: AuthDeliveryProcessor;
  let authDeliveryQueue: ReturnType<typeof createAuthDeliveryQueue>;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough";
    process.env.APP_PUBLIC_URL = "http://localhost:4200";
    process.env.PASSWORD_RESET_EXPIRES_MINUTES = "30";
    prisma = new RecoveryPrisma();
    sentMessages = [];
    prisma.users.push({
      id: "user-1",
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      passwordHash: await argon2.hash("OriginalPass123!", { type: argon2.argon2id }),
      authVersion: 0,
      locale: "es",
      status: UserStatus.ACTIVE,
      emailVerifiedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
    sendPasswordResetEmail = jest.fn(async (message: PasswordResetEmailRequest) => {
      sentMessages.push(message);
      return {
        recipient: message.recipient.trim().toLowerCase(),
        messageId: "<password-reset@mail.local>",
        accepted: [message.recipient.trim().toLowerCase()],
        rejected: []
      };
    });
    const mailService = {
      getPasswordResetPolicy: () => ({
        appPublicUrl: "http://localhost:4200",
        expiresMinutes: 30
      }),
      sendPasswordResetEmail,
      getEmailVerificationPolicy: () => ({
        appPublicUrl: "http://localhost:4200",
        expiresMinutes: 1440
      }),
      sendEmailVerification: jest.fn()
    };
    const authRateLimits = {
      assertRegisterAllowed: jest.fn(async () => undefined),
      assertLoginAllowed: jest.fn(async () => undefined),
      allowForgotPassword: jest.fn(async () => true),
      assertResetPasswordAllowed: jest.fn(async () => undefined),
      allowVerificationResend: jest.fn(async () => true),
      assertEmailVerificationAllowed: jest.fn(async () => undefined)
    };
    authDeliveryQueue = createAuthDeliveryQueue();
    service = new AuthService(
      prisma as unknown as ConstructorParameters<typeof AuthService>[0],
      new JwtService(),
      mailService as unknown as ConstructorParameters<typeof AuthService>[2],
      authRateLimits as unknown as ConstructorParameters<typeof AuthService>[3],
      authDeliveryQueue as unknown as ConstructorParameters<typeof AuthService>[4]
    );
    processor = new AuthDeliveryProcessor(
      prisma as unknown as ConstructorParameters<typeof AuthDeliveryProcessor>[0],
      mailService as unknown as ConstructorParameters<typeof AuthDeliveryProcessor>[1]
    );
  });

  it("returns the same public response for existing and missing users", async () => {
    const existing = await service.forgotPassword({ email: " ADA@EXAMPLE.COM " }, context);
    const missing = await service.forgotPassword({ email: "missing@example.com" }, context);

    expect(existing).toEqual(missing);
    expect(authDeliveryQueue.enqueuePasswordReset).toHaveBeenNthCalledWith(
      1,
      "ada@example.com",
      context
    );
    expect(authDeliveryQueue.enqueuePasswordReset).toHaveBeenNthCalledWith(
      2,
      "missing@example.com",
      context
    );
    expect(sentMessages).toHaveLength(0);
  });

  it("stores only a SHA-256 token hash and hashes request context", async () => {
    await processPasswordReset(processor);
    const rawToken = resetTokenFromMessage(sentMessages[0]);
    const stored = prisma.passwordResetTokens[0];

    expect(stored.tokenHash).toBe(createHash("sha256").update(rawToken).digest("hex"));
    expect(stored.sentAt).toBeInstanceOf(Date);
    expect(JSON.stringify(stored)).not.toContain(rawToken);
    expect(stored.requestedIpHash).not.toContain(context.ipAddress);
    expect(stored.userAgentHash).not.toContain(context.userAgent);
  });

  it("revokes a previous valid token when requesting another", async () => {
    await processPasswordReset(processor);
    await processPasswordReset(processor);

    expect(prisma.passwordResetTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(prisma.passwordResetTokens[1]?.revokedAt).toBeNull();
  });

  it.each([
    ["expired", ERROR_CODES.passwordResetTokenExpired],
    ["used", ERROR_CODES.passwordResetTokenUsed],
    ["revoked", ERROR_CODES.passwordResetTokenRevoked]
  ])("rejects a %s token with a stable code", async (state, code) => {
    await processPasswordReset(processor);
    const token = prisma.passwordResetTokens[0];
    if (state === "expired") token.expiresAt = new Date(Date.now() - 1000);
    if (state === "used") token.usedAt = new Date();
    if (state === "revoked") token.revokedAt = new Date();

    await expectErrorCode(
      service.resetPassword(resetPayload(resetTokenFromMessage(sentMessages[0])), context),
      code
    );
  });

  it("does not issue recovery email for an inactive account", async () => {
    prisma.users[0].status = UserStatus.INACTIVE;

    await processPasswordReset(processor);

    expect(sentMessages).toHaveLength(0);
    expect(prisma.passwordResetTokens).toHaveLength(0);
  });

  it("does not issue recovery email for an unverified account", async () => {
    prisma.users[0].emailVerifiedAt = null;

    await processPasswordReset(processor);

    expect(sentMessages).toHaveLength(0);
    expect(prisma.passwordResetTokens).toHaveLength(0);
  });

  it("revokes an unsent token when SMTP fails", async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(
      new MailDeliveryError("ECONNREFUSED", "connection", "SMTP unavailable")
    );

    await expect(processPasswordReset(processor)).rejects.toBeInstanceOf(MailDeliveryError);

    expect(prisma.passwordResetTokens[0]?.sentAt).toBeNull();
    expect(prisma.passwordResetTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(prisma.authAuditLogs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: "password_reset_failed",
          success: false,
          metadata: { reason: "ECONNREFUSED" }
        })
      ])
    );
    expect(prisma.authAuditLogs.some((entry) => entry.event === "password_reset_requested")).toBe(
      false
    );
  });

  it("keeps only one valid token after a delivery retry", async () => {
    sendPasswordResetEmail.mockRejectedValueOnce(
      new MailDeliveryError("ECONNRESET", "delivery", "SMTP connection reset")
    );

    await expect(processPasswordReset(processor)).rejects.toBeInstanceOf(MailDeliveryError);
    await expect(processPasswordReset(processor)).resolves.toBeUndefined();

    expect(prisma.passwordResetTokens).toHaveLength(2);
    expect(prisma.passwordResetTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(prisma.passwordResetTokens[1]).toMatchObject({
      sentAt: expect.any(Date),
      revokedAt: null,
      usedAt: null
    });
    expect(
      prisma.passwordResetTokens.filter(
        (token) => token.sentAt && !token.revokedAt && !token.usedAt
      )
    ).toHaveLength(1);
  });

  it("rejects mismatched, personal, and reused passwords", async () => {
    await processPasswordReset(processor);
    const token = resetTokenFromMessage(sentMessages[0]);

    await expectErrorCode(
      service.resetPassword(
        { token, password: "UpdatedPass456!", confirmPassword: "DifferentPass789!" },
        context
      ),
      ERROR_CODES.passwordMismatch
    );
    await expectErrorCode(
      service.resetPassword({ token, password: "ada@example.com", confirmPassword: "ada@example.com" }, context),
      ERROR_CODES.passwordPolicy
    );
    await expectErrorCode(
      service.resetPassword(resetPayload(token, "OriginalPass123!"), context),
      ERROR_CODES.passwordReuse
    );
    expect(prisma.passwordResetTokens[0]?.usedAt).toBeNull();
  });

  it("updates the password and atomically invalidates active sessions", async () => {
    prisma.refreshTokens.push({
      id: "refresh-1",
      userId: "user-1",
      tokenHash: "argon-hash",
      expiresAt: new Date(Date.now() + 60_000),
      revokedAt: null,
      createdAt: new Date()
    });
    await processPasswordReset(processor);
    const token = resetTokenFromMessage(sentMessages[0]);

    await expect(service.resetPassword(resetPayload(token), context)).resolves.toEqual({
      message: "Tu contraseña fue actualizada correctamente."
    });

    expect(prisma.passwordResetTokens[0]?.usedAt).toBeInstanceOf(Date);
    expect(prisma.refreshTokens[0]?.revokedAt).toBeInstanceOf(Date);
    expect(prisma.users[0]?.authVersion).toBe(1);
    expect(await argon2.verify(prisma.users[0].passwordHash, "UpdatedPass456!")).toBe(true);
    expect(prisma.authAuditLogs.some((entry) => entry.event === "password_reset_completed")).toBe(true);
    expect(JSON.stringify(prisma.authAuditLogs)).not.toContain(token);
  });

  it("rejects a consumed token and limits repeated reset attempts", async () => {
    await processPasswordReset(processor);
    const token = resetTokenFromMessage(sentMessages[0]);
    await service.resetPassword(resetPayload(token), context);

    await expectErrorCode(
      service.resetPassword(resetPayload(token, "AnotherPass789!"), context),
      ERROR_CODES.passwordResetTokenUsed
    );
  });
});

async function processPasswordReset(processor: AuthDeliveryProcessor): Promise<void> {
  await processor.process({
    name: "password-reset",
    data: {
      email: "ada@example.com",
      ipHash: "request-ip-hash",
      userAgentHash: "request-agent-hash",
      requestId: "request-1"
    }
  } as unknown as Parameters<AuthDeliveryProcessor["process"]>[0]);
}

function createAuthDeliveryQueue() {
  return {
    enqueuePasswordReset: jest.fn(
      async (_email: string, _context: { ipAddress: string; userAgent?: string }) => undefined
    ),
    enqueueVerificationResend: jest.fn(
      async (_email: string, _context: { ipAddress: string; userAgent?: string }) => undefined
    )
  };
}

function resetPayload(token: string, password = "UpdatedPass456!"): {
  token: string;
  password: string;
  confirmPassword: string;
} {
  return { token, password, confirmPassword: password };
}

function resetTokenFromMessage(message: PasswordResetEmailRequest | undefined): string {
  if (!message) {
    throw new Error("Password reset email was not sent");
  }
  const token = new URL(message.resetUrl).searchParams.get("token");
  if (!token) {
    throw new Error("Password reset token was not found in email");
  }
  return token;
}

async function expectErrorCode(promise: Promise<unknown>, expectedCode: string): Promise<void> {
  try {
    await promise;
    throw new Error(`Expected ${expectedCode}`);
  } catch (error) {
    expect(error).toBeInstanceOf(HttpException);
    const response = (error as HttpException).getResponse() as { code?: string };
    expect(response.code).toBe(expectedCode);
  }
}
