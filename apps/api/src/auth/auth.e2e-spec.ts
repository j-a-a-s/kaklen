import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Prisma, RefreshToken, User, UserStatus } from "@prisma/client";
import cookieParser from "cookie-parser";
import request from "supertest";
import { KAKLEN_API_PREFIX } from "@kaklen/shared";
import { AppModule } from "../app.module";
import { PrismaService } from "../prisma/prisma.service";

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
    }
  };

  readonly refreshToken = {
    create: async ({
      data
    }: {
      data: Prisma.RefreshTokenUncheckedCreateInput;
    }): Promise<RefreshToken> => {
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

  async onModuleInit(): Promise<void> {
    return undefined;
  }

  async onModuleDestroy(): Promise<void> {
    return undefined;
  }
}

describe("Auth E2E", () => {
  let app: INestApplication;
  let server: Parameters<typeof request>[0];

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = "e2e-access-secret-that-is-long-enough";
    process.env.JWT_REFRESH_SECRET = "e2e-refresh-secret-that-is-long-enough";
    process.env.JWT_ACCESS_EXPIRES_SECONDS = "900";
    process.env.JWT_REFRESH_EXPIRES_SECONDS = "604800";
    process.env.COOKIE_SECURE = "false";
    process.env.AUTH_ALLOWED_ORIGINS = "http://localhost:4200";

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(PrismaService)
      .useValue(new FakePrismaService())
      .compile();

    app = moduleRef.createNestApplication();
    app.use(cookieParser());
    app.setGlobalPrefix(KAKLEN_API_PREFIX);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true
      })
    );
    await app.init();
    server = app.getHttpAdapter().getInstance() as Parameters<typeof request>[0];
  });

  afterEach(async () => {
    await app.close();
  });

  it("registers and sets an HttpOnly refresh cookie", async () => {
    const response = await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.user.email).toBe("ada@example.com");
    expect(response.body.user.passwordHash).toBeUndefined();
    expect(response.headers["set-cookie"][0]).toContain("kaklen_refresh_token=");
    expect(response.headers["set-cookie"][0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"][0]).toContain("SameSite=Lax");
  });

  it("rejects an incorrect login", async () => {
    await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);

    await request(server)
      .post("/api/auth/login")
      .send({ email: "ada@example.com", password: "wrong-password" })
      .expect(401);
  });

  it("refreshes with rotation", async () => {
    const registered = await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);
    const firstCookie = registered.headers["set-cookie"][0];

    const refreshed = await request(server)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", firstCookie)
      .expect(200);

    expect(refreshed.body.accessToken).toEqual(expect.any(String));
    expect(refreshed.headers["set-cookie"][0]).toContain("kaklen_refresh_token=");
    expect(refreshed.headers["set-cookie"][0]).not.toBe(firstCookie);
  });

  it("rejects the previous refresh token after rotation", async () => {
    const registered = await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);
    const firstCookie = registered.headers["set-cookie"][0];

    await request(server)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", firstCookie)
      .expect(200);

    await request(server)
      .post("/api/auth/refresh")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", firstCookie)
      .expect(401);
  });

  it("rejects /me without a JWT", async () => {
    await request(server).get("/api/auth/me").expect(401);
  });

  it("logs out and clears the refresh cookie", async () => {
    const registered = await request(server)
      .post("/api/auth/register")
      .send(registerPayload("ada@example.com"))
      .expect(201);

    const response = await request(server)
      .post("/api/auth/logout")
      .set("Origin", "http://localhost:4200")
      .set("Cookie", registered.headers["set-cookie"][0])
      .expect(200);

    expect(response.body.message).toBe("Logged out");
    expect(response.headers["set-cookie"][0]).toContain("kaklen_refresh_token=;");
  });
});

function registerPayload(email: string): {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
} {
  return {
    email,
    firstName: "Ada",
    lastName: "Lovelace",
    password: "correct-password"
  };
}
