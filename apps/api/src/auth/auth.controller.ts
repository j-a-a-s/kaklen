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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse
} from "@nestjs/swagger";
import { SkipThrottle, Throttle, ThrottlerGuard } from "@nestjs/throttler";
import type { Request, Response } from "express";
import { readAuthConfig } from "@kaklen/config";
import { AuthService } from "./auth.service";
import type { AuthenticatedRequest, CookieRequest } from "./auth.types";
import { AuthResponseDto, AuthUserDto, MessageResponseDto } from "./dto/auth-response.dto";
import {
  ResendVerificationEmailDto,
  VerifyEmailDto
} from "./dto/email-verification.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/password-recovery.dto";
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
  @ApiCreatedResponse({ type: MessageResponseDto })
  @ApiConflictResponse({ description: "Email is already registered" })
  register(
    @Body() dto: RegisterDto,
    @Req() request: Request
  ): Promise<MessageResponseDto> {
    return this.authService.register(dto, this.authRequestContext(request));
  }

  @Post("login")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @ApiOperation({ summary: "Login with email and password" })
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: "Invalid credentials" })
  @ApiForbiddenResponse({ description: "Email address has not been verified" })
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

  @Post("verify-email")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Confirm an email address using a single-use token" })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: "Verification token is invalid" })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<MessageResponseDto> {
    return this.authService.verifyEmail(dto);
  }

  @Post("resend-verification-email")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({ summary: "Resend account confirmation instructions when eligible" })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiTooManyRequestsResponse({ description: "Too many resend attempts" })
  resendVerificationEmail(
    @Body() dto: ResendVerificationEmailDto,
    @Req() request: Request
  ): Promise<MessageResponseDto> {
    return this.authService.resendVerificationEmail(
      dto,
      this.authRequestContext(request)
    );
  }

  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  @SkipThrottle()
  @ApiOperation({ summary: "Send password recovery instructions when the account is eligible" })
  @ApiOkResponse({ type: MessageResponseDto })
  forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Req() request: Request
  ): Promise<MessageResponseDto> {
    return this.authService.forgotPassword(dto, this.authRequestContext(request));
  }

  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Replace a password using a single-use recovery token" })
  @ApiOkResponse({ type: MessageResponseDto })
  @ApiBadRequestResponse({ description: "Token or password is invalid" })
  @ApiTooManyRequestsResponse({ description: "Too many reset attempts" })
  resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() request: Request
  ): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto, this.authRequestContext(request));
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

  private authRequestContext(request: Request & { requestId?: string }): {
    ipAddress: string;
    userAgent?: string;
    requestId?: string;
  } {
    const userAgent = request.headers["user-agent"];
    return {
      ipAddress: request.ip || request.socket.remoteAddress || "unknown",
      ...(typeof userAgent === "string" ? { userAgent } : {}),
      ...(request.requestId ? { requestId: request.requestId } : {})
    };
  }
}
