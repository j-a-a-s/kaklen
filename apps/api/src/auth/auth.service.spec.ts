import { ConflictException, UnauthorizedException, ExecutionContext } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, RefreshToken, User, UserStatus } from "@prisma/client";
import * as argon2 from "argon2";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import type { AuthenticatedRequest } from "./auth.types";

type StoredRefreshToken = RefreshToken & { user?: User };

class FakePrismaService {
  private users: User[] = [];
  private refreshTokens: RefreshToken[] = [];

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
        locale: data.locale ?? "es",
        status: UserStatus.ACTIVE,
        createdAt: now,
        updatedAt: now
      };
      this.users.push(user);
      return user;
    },
    findUnique: async ({ where }: { where: Prisma.UserWhereUniqueInput }): Promise<User | null> => {
      return this.users.find((user) => user.email === where.email || user.id === where.id) ?? null;
    },
    findFirst: async ({ where }: { where: Prisma.UserWhereInput }): Promise<User | null> => {
      return (
        this.users.find((user) => {
          const idMatches = !where.id || where.id === user.id;
          const statusMatches = !where.status || where.status === user.status;
          return idMatches && statusMatches;
        }) ?? null
      );
    },
    update: async ({
      where,
      data
    }: {
      where: Prisma.UserWhereUniqueInput;
      data: Prisma.UserUpdateInput;
    }): Promise<User> => {
      const user = this.users.find((item) => item.id === where.id);
      if (!user) {
        throw new Error("User not found");
      }

      if (typeof data.locale === "string") {
        user.locale = data.locale;
      }
      user.updatedAt = new Date();
      return user;
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
          user: this.users.find((user) => user.id === token.userId)
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
      const token = this.refreshTokens.find((refreshToken) => refreshToken.id === where.id);
      if (!token) {
        throw new Error("Refresh token not found");
      }

      token.revokedAt = data.revokedAt instanceof Date ? data.revokedAt : new Date();
      return token;
    }
  };

  async $transaction<T>(callback: (tx: FakePrismaService) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async findRefreshTokenByPlainValue(refreshToken: string): Promise<RefreshToken | null> {
    for (const storedToken of this.refreshTokens) {
      if (await argon2.verify(storedToken.tokenHash, refreshToken)) {
        return storedToken;
      }
    }

    return null;
  }

  setUserStatus(email: string, status: UserStatus): void {
    const user = this.users.find((item) => item.email === email);
    if (user) {
      user.status = status;
    }
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

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = "test-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "test-refresh-secret-that-is-long-enough";
    process.env.JWT_ACCESS_EXPIRES_SECONDS = "900";
    process.env.JWT_REFRESH_EXPIRES_SECONDS = "604800";
    prisma = new FakePrismaService();
    service = new AuthService(
      prisma as unknown as ConstructorParameters<typeof AuthService>[0],
      new JwtService()
    );
  });

  it("registers a user successfully", async () => {
    const result = await service.register({
      email: "Ada@Example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    expect(result.user.email).toBe("ada@example.com");
    expect(result.accessToken).toEqual(expect.any(String));
    expect(result.refreshToken).toEqual(expect.any(String));
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it("rejects duplicate email registration", async () => {
    const dto = {
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    };
    await service.register(dto);

    await expect(service.register(dto)).rejects.toBeInstanceOf(ConflictException);
  });

  it("logs in with valid credentials", async () => {
    await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    const result = await service.login({
      email: "ada@example.com",
      password: "correct-password"
    });

    expect(result.user.email).toBe("ada@example.com");
    expect(result.accessToken).toEqual(expect.any(String));
  });

  it("rejects invalid login credentials without exposing account state", async () => {
    await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    await expect(
      service.login({ email: "ada@example.com", password: "wrong-password" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      service.login({ email: "missing@example.com", password: "wrong-password" })
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects login for inactive users with the same generic error", async () => {
    await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });
    prisma.setUserStatus("ada@example.com", UserStatus.DISABLED);

    await expect(service.login({ email: "ada@example.com", password: "correct-password" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("rejects missing, invalid, and expired refresh tokens", async () => {
    const registered = await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    await expect(service.refresh(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(service.refresh("not-a-stored-token")).rejects.toBeInstanceOf(UnauthorizedException);

    prisma.expireRefreshTokens();
    await expect(service.refresh(registered.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("refreshes a valid refresh token and rotates it", async () => {
    const registered = await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    const refreshed = await service.refresh(registered.refreshToken);
    const oldToken = await prisma.findRefreshTokenByPlainValue(registered.refreshToken);
    const nextToken = await prisma.findRefreshTokenByPlainValue(refreshed.refreshToken);

    expect(refreshed.accessToken).toEqual(expect.any(String));
    expect(oldToken?.revokedAt).toBeInstanceOf(Date);
    expect(nextToken?.revokedAt).toBeNull();
  });

  it("rejects a revoked refresh token", async () => {
    const registered = await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });
    await service.logout(registered.refreshToken);

    await expect(service.refresh(registered.refreshToken)).rejects.toBeInstanceOf(
      UnauthorizedException
    );
  });

  it("treats logout without a matching refresh token as idempotent", async () => {
    await service.logout(undefined);
    await service.logout("not-a-stored-token");

    expect(prisma.revokedRefreshTokenCount()).toBe(0);
  });

  it("rejects /me for missing or inactive users", async () => {
    await expect(service.me("missing-user")).rejects.toBeInstanceOf(UnauthorizedException);
    await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });
    prisma.setUserStatus("ada@example.com", UserStatus.DISABLED);

    await expect(service.me("user-1")).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("updates the authenticated user locale preference", async () => {
    const registered = await service.register({
      email: "ada@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      password: "correct-password"
    });

    const updated = await service.updatePreferences(registered.user.id, { locale: "pt-BR" });

    expect(updated.locale).toBe("pt-BR");
  });
});

describe("JwtAuthGuard", () => {
  it("protects authenticated endpoints when the access token is missing", async () => {
    const guard = new JwtAuthGuard(new JwtService());
    const request = { headers: {} } as AuthenticatedRequest;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request
      })
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
