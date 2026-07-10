import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Response } from "express";
import { readAuthConfig } from "@kaklen/config";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest, CookieRequest } from "./auth.types";
import { AuthResponseDto, AuthUserDto, MessageResponseDto } from "./dto/auth-response.dto";
import { LoginDto } from "./dto/login.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { JwtAuthGuard } from "./jwt-auth.guard";

const REFRESH_COOKIE_NAME = "kaklen_refresh_token";

@ApiTags("auth")
@Controller("auth")
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("register")
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: "Register a new user" })
  @ApiCreatedResponse({ type: AuthResponseDto })
  @ApiConflictResponse({ description: "Email is already registered" })
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.register(dto);
    this.setRefreshCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken
    };
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    const result = await this.authService.login(dto);
    this.setRefreshCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken
    };
  }

  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: "Rotate refresh token and issue a new access token" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Refresh token is missing, expired, or revoked" })
  async refresh(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<AuthResponseDto> {
    this.assertAllowedOrigin(request);
    const result = await this.authService.refresh(request.cookies?.[REFRESH_COOKIE_NAME]);
    this.setRefreshCookie(response, result.refreshToken);

    return {
      user: result.user,
      accessToken: result.accessToken
    };
  }

  @Post("logout")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: "Revoke the current refresh token" })
  @ApiOkResponse({ type: MessageResponseDto })
  async logout(
    @Req() request: CookieRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<MessageResponseDto> {
    this.assertAllowedOrigin(request);
    await this.authService.logout(request.cookies?.[REFRESH_COOKIE_NAME]);
    this.clearRefreshCookie(response);

    return { message: "Logged out" };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the current authenticated user" })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: "Access token is missing or invalid" })
  me(@Req() request: AuthenticatedRequest): Promise<AuthUserDto> {
    return this.authService.me(request.user.sub);
  }

  @Patch("me/preferences")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Update current user preferences" })
  @ApiOkResponse({ type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: "Access token is missing or invalid" })
  updatePreferences(
    @Req() request: AuthenticatedRequest,
    @Body() dto: UpdatePreferencesDto
  ): Promise<AuthUserDto> {
    return this.authService.updatePreferences(request.user.sub, dto);
  }

  private setRefreshCookie(response: Response, refreshToken: string): void {
    const config = readAuthConfig(process.env);
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/api/auth",
      maxAge: config.jwtRefreshExpiresSeconds * 1000
    });
  }

  private clearRefreshCookie(response: Response): void {
    const config = readAuthConfig(process.env);
    response.clearCookie(REFRESH_COOKIE_NAME, {
      httpOnly: true,
      secure: config.cookieSecure,
      sameSite: "lax",
      path: "/api/auth"
    });
  }

  private assertAllowedOrigin(request: CookieRequest): void {
    const origin = request.headers.origin;

    if (!origin) {
      return;
    }

    const config = readAuthConfig(process.env);
    if (!config.authAllowedOrigins.includes(origin)) {
      throw new ForbiddenException("Origin is not allowed");
    }
  }
}
