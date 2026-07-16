import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import {
  EmailVerificationToken,
  PasswordResetToken,
  Prisma,
  User,
  UserStatus
} from "@prisma/client";
import { createHash, createHmac, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { readAuthConfig } from "@kaklen/config";
import {
  PASSWORD_MIN_LENGTH,
  type AuthResponse,
  type AuthUser,
  type MessageResponse
} from "@kaklen/shared";
import { ERROR_CODES } from "../common/error-codes";
import { MailDeliveryError, MailService } from "../notifications/mail.service";
import { normalizeNotificationLocale } from "../notifications/templates";
import { PrismaService } from "../prisma/prisma.service";
import type {
  AuthRequestContext,
  JwtAccessPayload,
  PasswordRecoveryRequestContext
} from "./auth.types";
import {
  ResendVerificationEmailDto,
  VerifyEmailDto
} from "./dto/email-verification.dto";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto, ResetPasswordDto } from "./dto/password-recovery.dto";
import { RegisterDto } from "./dto/register.dto";
import { UpdatePreferencesDto } from "./dto/update-preferences.dto";
import { EmailVerificationRateLimitService } from "./email-verification-rate-limit.service";
import { PasswordRecoveryRateLimitService } from "./password-recovery-rate-limit.service";

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

type PasswordResetTokenWithUser = PasswordResetToken & { user: User };
type EmailVerificationTokenWithUser = EmailVerificationToken & { user: User };

interface PendingEmailVerification {
  rawToken: string;
  token: EmailVerificationToken;
  user: User;
}

const FORGOT_PASSWORD_MESSAGE =
  "Si existe una cuenta asociada, enviaremos instrucciones para recuperar el acceso.";
const RESET_PASSWORD_MESSAGE = "Tu contraseña fue actualizada correctamente.";
const REGISTER_MESSAGE = "Cuenta creada. Revisa tu correo para confirmar tu dirección.";
const VERIFY_EMAIL_MESSAGE = "Tu correo fue confirmado correctamente.";
const RESEND_VERIFICATION_MESSAGE =
  "Si la cuenta requiere confirmación, enviaremos un nuevo correo.";

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly recoveryRateLimit: PasswordRecoveryRateLimitService,
    private readonly verificationRateLimit: EmailVerificationRateLimitService
  ) {}

  async register(dto: RegisterDto, context: AuthRequestContext): Promise<MessageResponse> {
    const email = this.normalizeEmail(dto.email);
    const firstName = dto.firstName.trim();
    const lastName = dto.lastName.trim();
    this.assertIdentitySafePassword(dto.password, { email, firstName, lastName });
    const passwordHash = await this.hashSecret(dto.password);

    try {
      const pending = await this.prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            passwordHash,
            locale: dto.locale ?? "es",
            emailVerifiedAt: null
          }
        });
        return this.createEmailVerificationToken(user, tx);
      });
      await this.deliverEmailVerification(pending, context, "registration");
      return { message: REGISTER_MESSAGE };
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

    if (!user) {
      throw new UnauthorizedException("Invalid credentials");
    }

    const validPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!validPassword || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Invalid credentials");
    }

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException({
        code: ERROR_CODES.emailNotVerified,
        message: "Debes confirmar tu correo antes de iniciar sesión."
      });
    }

    const tokens = await this.issueTokens(user);

    return {
      user: this.toAuthUser(user),
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken
    };
  }

  async verifyEmail(dto: VerifyEmailDto): Promise<MessageResponse> {
    const tokenHash = this.hashEmailVerificationToken(dto.token);
    const storedToken = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken) {
      throw this.emailVerificationTokenException(
        ERROR_CODES.emailVerificationTokenInvalid
      );
    }

    const now = new Date();
    const tokenErrorCode = this.emailVerificationTokenErrorCode(storedToken, now);
    if (tokenErrorCode || storedToken.user.status !== UserStatus.ACTIVE) {
      const code = tokenErrorCode ?? ERROR_CODES.emailVerificationTokenInvalid;
      await this.auditEmailVerificationFailure(storedToken.userId, code);
      throw this.emailVerificationTokenException(code);
    }

    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.emailVerificationToken.updateMany({
        where: {
          id: storedToken.id,
          sentAt: { not: null },
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: { usedAt: now }
      });
      if (claimed.count !== 1) {
        throw this.emailVerificationTokenException(
          this.emailVerificationTokenErrorCode(storedToken, now)
        );
      }

      await tx.user.update({
        where: { id: storedToken.userId },
        data: { emailVerifiedAt: now }
      });
      await tx.emailVerificationToken.updateMany({
        where: {
          userId: storedToken.userId,
          id: { not: storedToken.id },
          usedAt: null,
          revokedAt: null
        },
        data: { revokedAt: now }
      });
      await tx.authAuditLog.create({
        data: {
          userId: storedToken.userId,
          event: "email_verified",
          success: true
        }
      });
    });

    return { message: VERIFY_EMAIL_MESSAGE };
  }

  async resendVerificationEmail(
    dto: ResendVerificationEmailDto,
    context: AuthRequestContext
  ): Promise<MessageResponse> {
    const startedAt = Date.now();
    const email = this.normalizeEmail(dto.email);
    if (this.verificationRateLimit.allowResend(email)) {
      await this.processVerificationResend(email, context);
    }
    await this.ensureMinimumDuration(startedAt, 250);
    return { message: RESEND_VERIFICATION_MESSAGE };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    context: PasswordRecoveryRequestContext
  ): Promise<MessageResponse> {
    const startedAt = Date.now();
    const email = this.normalizeEmail(dto.email);
    const allowed = this.recoveryRateLimit.allowForgot(email, context.ipAddress);

    if (allowed) {
      await this.processPasswordResetRequest(email, context);
    }

    await this.ensureMinimumDuration(startedAt, 250);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    context: PasswordRecoveryRequestContext
  ): Promise<MessageResponse> {
    this.recoveryRateLimit.assertResetAllowed(dto.token, context.ipAddress);
    const tokenHash = this.hashResetToken(dto.token);
    const storedToken = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!storedToken) {
      throw this.resetTokenException(ERROR_CODES.passwordResetTokenInvalid);
    }

    const tokenErrorCode = this.tokenErrorCode(storedToken, new Date());
    if (
      tokenErrorCode ||
      storedToken.user.status !== UserStatus.ACTIVE ||
      !storedToken.user.emailVerifiedAt
    ) {
      const code = tokenErrorCode ?? ERROR_CODES.passwordResetTokenInvalid;
      await this.auditResetFailure(storedToken.userId, code);
      throw this.resetTokenException(code);
    }

    if (dto.password !== dto.confirmPassword) {
      await this.auditResetFailure(storedToken.userId, ERROR_CODES.passwordMismatch);
      throw this.passwordException(
        ERROR_CODES.passwordMismatch,
        "Password confirmation does not match"
      );
    }

    try {
      this.assertIdentitySafePassword(dto.password, storedToken.user);
    } catch (error) {
      await this.auditResetFailure(storedToken.userId, ERROR_CODES.passwordPolicy);
      throw error;
    }

    if (await argon2.verify(storedToken.user.passwordHash, dto.password)) {
      await this.auditResetFailure(storedToken.userId, ERROR_CODES.passwordReuse);
      throw this.passwordException(
        ERROR_CODES.passwordReuse,
        "New password must be different from the current password"
      );
    }

    const passwordHash = await this.hashSecret(dto.password);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const claimed = await tx.passwordResetToken.updateMany({
        where: {
          id: storedToken.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: { usedAt: now }
      });
      if (claimed.count !== 1) {
        throw this.resetTokenException(this.tokenErrorCode(storedToken, now));
      }

      await tx.user.update({
        where: { id: storedToken.userId },
        data: {
          passwordHash,
          authVersion: { increment: 1 }
        }
      });
      await tx.refreshToken.updateMany({
        where: { userId: storedToken.userId, revokedAt: null },
        data: { revokedAt: now }
      });
      await tx.authAuditLog.create({
        data: {
          userId: storedToken.userId,
          event: "password_reset_completed",
          success: true
        }
      });
    });

    return { message: RESET_PASSWORD_MESSAGE };
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResponse & { refreshToken: string }> {
    if (!refreshToken) {
      throw new UnauthorizedException("Authentication required");
    }

    const tokens = await this.prisma.refreshToken.findMany({
      where: {
        revokedAt: null,
        expiresAt: { gt: new Date() },
        user: { status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } }
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

          return this.issueTokens(storedToken.user, tx);
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
      where: { id: userId, status: UserStatus.ACTIVE, emailVerifiedAt: { not: null } }
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

  private async processPasswordResetRequest(
    email: string,
    context: PasswordRecoveryRequestContext
  ): Promise<void> {
    const rawToken = randomBytes(48).toString("base64url");
    const tokenHash = this.hashResetToken(rawToken);
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      if (user) {
        await this.auditResetFailure(user.id, "ACCOUNT_INACTIVE");
      }
      return;
    }

    const config = this.mailService.getPasswordResetPolicy();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + config.expiresMinutes * 60 * 1000);
    const resetToken = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          revokedAt: null,
          expiresAt: { gt: now }
        },
        data: { revokedAt: now }
      });
      const created = await tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
          requestedIpHash: this.hashRequestContext(context.ipAddress),
          userAgentHash: context.userAgent
            ? this.hashRequestContext(context.userAgent)
            : null
        }
      });
      return created;
    });

    const locale = normalizeNotificationLocale(user.locale);
    const resetUrl = new URL(`/${locale}/reset-password`, `${config.appPublicUrl}/`);
    resetUrl.searchParams.set("token", rawToken);

    try {
      const receipt = await this.mailService.sendPasswordResetEmail({
        recipient: user.email,
        locale,
        resetUrl: resetUrl.toString(),
        expiresInMinutes: config.expiresMinutes,
        ...(context.requestId ? { requestId: context.requestId } : {})
      });
      const sentAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const markedSent = await tx.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            revokedAt: null,
            sentAt: null
          },
          data: { sentAt }
        });
        if (markedSent.count !== 1) {
          throw new Error("Password reset token could not be marked as sent");
        }
        await tx.authAuditLog.create({
          data: {
            userId: user.id,
            event: "password_reset_requested",
            success: true,
            metadata: {
              expiresMinutes: config.expiresMinutes,
              locale,
              messageId: receipt.messageId
            }
          }
        });
      });
    } catch (error) {
      const reason =
        error instanceof MailDeliveryError ? error.code : "PASSWORD_RESET_STATE_FAILED";
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.passwordResetToken.updateMany({
            where: { id: resetToken.id, usedAt: null, revokedAt: null },
            data: { revokedAt: new Date() }
          });
          await tx.authAuditLog.create({
            data: {
              userId: user.id,
              event: "password_reset_failed",
              success: false,
              metadata: { reason }
            }
          });
        });
      } catch {
        this.logPasswordResetStateFailure(user.id, "TOKEN_REVOCATION_FAILED", context.requestId);
      }
      if (!(error instanceof MailDeliveryError)) {
        this.logPasswordResetStateFailure(user.id, reason, context.requestId);
      }
    }
  }

  private async auditResetFailure(userId: string, reason: string): Promise<void> {
    await this.prisma.authAuditLog.create({
      data: {
        userId,
        event: "password_reset_failed",
        success: false,
        metadata: { reason }
      }
    });
  }

  private async processVerificationResend(
    email: string,
    context: AuthRequestContext
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || user.status !== UserStatus.ACTIVE || user.emailVerifiedAt) {
      return;
    }

    const pending = await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          revokedAt: null
        },
        data: { revokedAt: new Date() }
      });
      return this.createEmailVerificationToken(user, tx);
    });
    await this.deliverEmailVerification(pending, context, "resend");
  }

  private async createEmailVerificationToken(
    user: User,
    tx: Prisma.TransactionClient | PrismaService
  ): Promise<PendingEmailVerification> {
    const policy = this.mailService.getEmailVerificationPolicy();
    const rawToken = randomBytes(48).toString("base64url");
    const tokenHash = this.hashEmailVerificationToken(rawToken);
    const token = await tx.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + policy.expiresMinutes * 60 * 1000)
      }
    });
    return { rawToken, token, user };
  }

  private async deliverEmailVerification(
    pending: PendingEmailVerification,
    context: AuthRequestContext,
    source: "registration" | "resend"
  ): Promise<void> {
    const policy = this.mailService.getEmailVerificationPolicy();
    const locale = normalizeNotificationLocale(pending.user.locale);
    const verificationUrl = new URL(`/${locale}/verify-email`, `${policy.appPublicUrl}/`);
    verificationUrl.searchParams.set("token", pending.rawToken);

    try {
      const receipt = await this.mailService.sendEmailVerification({
        recipient: pending.user.email,
        locale,
        verificationUrl: verificationUrl.toString(),
        expiresInMinutes: policy.expiresMinutes,
        ...(context.requestId ? { requestId: context.requestId } : {})
      });
      const sentAt = new Date();
      await this.prisma.$transaction(async (tx) => {
        const markedSent = await tx.emailVerificationToken.updateMany({
          where: {
            id: pending.token.id,
            sentAt: null,
            usedAt: null,
            revokedAt: null
          },
          data: { sentAt }
        });
        if (markedSent.count !== 1) {
          throw new Error("Email verification token could not be marked as sent");
        }
        await tx.authAuditLog.create({
          data: {
            userId: pending.user.id,
            event: "email_verification_sent",
            success: true,
            metadata: {
              source,
              expiresMinutes: policy.expiresMinutes,
              locale,
              messageId: receipt.messageId
            }
          }
        });
      });
    } catch (error) {
      const reason =
        error instanceof MailDeliveryError ? error.code : "EMAIL_VERIFICATION_STATE_FAILED";
      try {
        await this.prisma.$transaction(async (tx) => {
          await tx.emailVerificationToken.updateMany({
            where: {
              id: pending.token.id,
              usedAt: null,
              revokedAt: null
            },
            data: { revokedAt: new Date() }
          });
          await tx.authAuditLog.create({
            data: {
              userId: pending.user.id,
              event: "email_verification_failed",
              success: false,
              metadata: { source, reason }
            }
          });
        });
      } catch {
        this.logEmailVerificationStateFailure(
          pending.user.id,
          "TOKEN_REVOCATION_FAILED",
          context.requestId
        );
      }
      if (!(error instanceof MailDeliveryError)) {
        this.logEmailVerificationStateFailure(
          pending.user.id,
          reason,
          context.requestId
        );
      }
    }
  }

  private async auditEmailVerificationFailure(
    userId: string,
    reason: string
  ): Promise<void> {
    await this.prisma.authAuditLog.create({
      data: {
        userId,
        event: "email_verification_failed",
        success: false,
        metadata: { reason }
      }
    });
  }

  private async issueTokens(
    user: Pick<User, "id" | "email" | "authVersion">,
    tx: Prisma.TransactionClient | PrismaService = this.prisma
  ): Promise<TokenPair> {
    const config = readAuthConfig(process.env);
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      sessionVersion: user.authVersion
    };
    const accessToken = await this.jwtService.signAsync(payload, {
      secret: config.jwtAccessSecret,
      expiresIn: config.jwtAccessExpiresSeconds
    });
    const refreshToken = randomBytes(48).toString("base64url");
    const tokenHash = await this.hashSecret(refreshToken);

    await tx.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + config.jwtRefreshExpiresSeconds * 1000)
      }
    });

    return { accessToken, refreshToken };
  }

  private assertIdentitySafePassword(
    password: string,
    identity: Pick<User, "email" | "firstName" | "lastName">
  ): void {
    if (password.length < PASSWORD_MIN_LENGTH) {
      throw this.passwordException(
        ERROR_CODES.passwordPolicy,
        `Password must contain at least ${PASSWORD_MIN_LENGTH} characters`
      );
    }

    const normalizedPassword = password.trim().toLocaleLowerCase("en-US");
    const firstName = identity.firstName.trim().toLocaleLowerCase("en-US");
    const lastName = identity.lastName.trim().toLocaleLowerCase("en-US");
    const personalValues = new Set([
      identity.email.trim().toLocaleLowerCase("en-US"),
      firstName,
      lastName,
      `${firstName}${lastName}`,
      `${firstName} ${lastName}`
    ]);

    if (personalValues.has(normalizedPassword)) {
      throw this.passwordException(
        ERROR_CODES.passwordPolicy,
        "Password must not match personal information"
      );
    }
  }

  private passwordException(code: string, message: string): BadRequestException {
    return new BadRequestException({ code, message });
  }

  private resetTokenException(code: string | null): HttpException {
    const resolvedCode = code ?? ERROR_CODES.passwordResetTokenInvalid;
    const messages: Record<string, string> = {
      [ERROR_CODES.passwordResetTokenInvalid]: "Password reset token is invalid",
      [ERROR_CODES.passwordResetTokenExpired]: "Password reset token has expired",
      [ERROR_CODES.passwordResetTokenUsed]: "Password reset token has already been used",
      [ERROR_CODES.passwordResetTokenRevoked]: "Password reset token has been revoked"
    };
    const status =
      resolvedCode === ERROR_CODES.passwordResetTokenInvalid
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.GONE;
    return new HttpException(
      {
        code: resolvedCode,
        message: messages[resolvedCode] ?? messages[ERROR_CODES.passwordResetTokenInvalid]
      },
      status
    );
  }

  private emailVerificationTokenException(code: string | null): HttpException {
    const resolvedCode = code ?? ERROR_CODES.emailVerificationTokenInvalid;
    const messages: Record<string, string> = {
      [ERROR_CODES.emailVerificationTokenInvalid]: "Email verification token is invalid",
      [ERROR_CODES.emailVerificationTokenExpired]: "Email verification token has expired",
      [ERROR_CODES.emailVerificationTokenUsed]: "Email verification token has already been used",
      [ERROR_CODES.emailVerificationTokenRevoked]: "Email verification token has been revoked"
    };
    const status =
      resolvedCode === ERROR_CODES.emailVerificationTokenInvalid
        ? HttpStatus.BAD_REQUEST
        : HttpStatus.GONE;
    return new HttpException(
      {
        code: resolvedCode,
        message:
          messages[resolvedCode] ?? messages[ERROR_CODES.emailVerificationTokenInvalid]
      },
      status
    );
  }

  private tokenErrorCode(token: PasswordResetTokenWithUser, now: Date): string | null {
    if (!token.sentAt) {
      return ERROR_CODES.passwordResetTokenInvalid;
    }
    if (token.usedAt) {
      return ERROR_CODES.passwordResetTokenUsed;
    }
    if (token.revokedAt) {
      return ERROR_CODES.passwordResetTokenRevoked;
    }
    if (token.expiresAt.getTime() <= now.getTime()) {
      return ERROR_CODES.passwordResetTokenExpired;
    }
    return null;
  }

  private emailVerificationTokenErrorCode(
    token: EmailVerificationTokenWithUser,
    now: Date
  ): string | null {
    if (!token.sentAt) {
      return ERROR_CODES.emailVerificationTokenInvalid;
    }
    if (token.usedAt) {
      return ERROR_CODES.emailVerificationTokenUsed;
    }
    if (token.revokedAt) {
      return ERROR_CODES.emailVerificationTokenRevoked;
    }
    if (token.expiresAt.getTime() <= now.getTime()) {
      return ERROR_CODES.emailVerificationTokenExpired;
    }
    if (token.user.emailVerifiedAt) {
      return ERROR_CODES.emailVerificationTokenUsed;
    }
    return null;
  }

  private hashSecret(secret: string): Promise<string> {
    return argon2.hash(secret, { type: argon2.argon2id });
  }

  private hashResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashEmailVerificationToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashRequestContext(value: string): string {
    const secret = readAuthConfig(process.env).jwtRefreshSecret;
    return createHmac("sha256", secret).update(value).digest("hex");
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private logPasswordResetStateFailure(
    userId: string,
    reason: string,
    requestId?: string
  ): void {
    this.logger.error(
      `[password-reset:failed] ${JSON.stringify({
        event: "password_reset.failed",
        userId,
        reason,
        timestamp: new Date().toISOString(),
        ...(requestId ? { requestId } : {})
      })}`
    );
  }

  private logEmailVerificationStateFailure(
    userId: string,
    reason: string,
    requestId?: string
  ): void {
    this.logger.error(
      `[email-verification:failed] ${JSON.stringify({
        event: "email_verification.failed",
        userId,
        reason,
        timestamp: new Date().toISOString(),
        ...(requestId ? { requestId } : {})
      })}`
    );
  }

  private toAuthUser(user: User): AuthUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      locale: user.locale,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString()
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private async ensureMinimumDuration(startedAt: number, minimumMs: number): Promise<void> {
    const remainingMs = minimumMs - (Date.now() - startedAt);
    if (remainingMs > 0) {
      await new Promise<void>((resolve) => setTimeout(resolve, remainingMs));
    }
  }
}
