import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { UserStatus } from "@prisma/client";
import { readAuthConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthenticatedRequest, JwtAccessPayload } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const config = readAuthConfig(process.env);
      const payload = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: config.jwtAccessSecret
      });
      const user = await this.prisma.user.findFirst({
        where: { id: payload.sub, status: UserStatus.ACTIVE },
        select: { authVersion: true }
      });
      if (!user || user.authVersion !== payload.sessionVersion) {
        throw new UnauthorizedException("Authentication required");
      }
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException("Authentication required");
    }
  }

  private extractBearerToken(header: string | undefined): string | null {
    if (!header) {
      return null;
    }

    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      return null;
    }

    return token;
  }
}
