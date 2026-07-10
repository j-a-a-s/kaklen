import {
  ConflictException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Prisma, User, UserStatus } from "@prisma/client";
import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { readAuthConfig } from "@kaklen/config";
import type { AuthResponse, AuthUser } from "@kaklen/shared";
import { PrismaService } from "../prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import type { JwtAccessPayload } from "./auth.types";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse & { refreshToken: string }> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await this.hashSecret(dto.password);

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash
        }
      });
      const tokens = await this.issueTokens(user.id, user.email);

      return {
        user: this.toAuthUser(user),
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken
      };
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException("Unable to create account with these credentials");
      }

      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResponse & { refreshToken: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) }
    });

    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const tokens = await this.issueTokens(user.id, user.email);

    return {
      user: this.toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResponse & { refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException("Authentication required");
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE }
      },
      include: { user: true }
    });

    for (const storedToken of tokens) {
      const tokenMatches = await argon2.verify(storedToken.tokenHash, refreshToken);
      if (tokenMatches) {
        const nextTokens = await this.prisma.$transaction(async (tx) => {
          await tx.refreshToken.update({
            where: { id: storedToken.id },
            data: { revokedAt: new Date() }
          });

          return this.issueTokens(storedToken.user.id, storedToken.user.email, tx);
        });

        return {
          user: this.toAuthUser(storedToken.user),
          accessToken: nextTokens.accessToken,
          refreshToken: nextTokens.refreshToken
        };
      }
    }

    throw new UnauthorizedException("Authentication required");
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) {
      return;
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() }
      }
    });

    for (const storedToken of tokens) {
      const tokenMatches = await argon2.verify(storedToken.tokenHash, refreshToken);
      if (tokenMatches) {
        await this.prisma.refreshToken.update({
          where: { id: storedToken.id },
          data: { revokedAt: new Date() }
        });
        return;
      }
    }
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE }
    });

    if (!user) {
      throw new UnauthorizedException("Authentication required");
    }

    return this.toAuthUser(user);
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto): Promise<AuthUser> {
    await this.me(userId);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { locale: dto.locale }
    });

    return this.toAuthUser(user);
  }

  private async issueTokens(
    userId: string,
    email: string,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<TokenPair> {
    const config = readAuthConfig(process.env);
    const payload: JwtAccessPayload = { sub: userId, email };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: config.jwtAccessSecret,
      expiresIn: config.jwtAccessExpiresSeconds
    });
    const refreshToken = randomBytes(48).toString("base64url");
    const tokenHash = await this.hashSecret(refreshToken);

    await tx.refreshToken.create({
      data: {
        userId,
        tokenHash,
        expiresAt: new Date(Date.now() + config.jwtRefreshExpiresSeconds * 1000)
      }
    });

    return { accessToken, refreshToken };
  }

  private hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret, { type: argon2.argon2id });
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }
}
