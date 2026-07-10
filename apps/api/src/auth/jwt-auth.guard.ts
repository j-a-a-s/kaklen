import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { readAuthConfig } from "@kaklen/config";
import type { AuthenticatedRequest, JwtAccessPayload } from "./auth.types";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Authentication required");
    }

    try {
      const config = readAuthConfig(process.env);
      request.user = await this.jwtService.verifyAsync<JwtAccessPayload>(token, {
        secret: config.jwtAccessSecret
      });
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
