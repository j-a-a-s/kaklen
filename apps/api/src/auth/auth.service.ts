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
import { createHash, randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { PasswordService } from "@kokecore/auth";
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
import { AuthDeliveryQueueService } from "./auth-delivery-queue.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";

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
export const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=65536,t=3,p=4$JHvJNhZYTo7VQWem3+scvQ$hawKgBESxfffwFVQHFH+JH3DXKuka28o63sinL6cHCE";
const ARGON2ID_HASH_PATTERN = /^\$argon2id\$v=19\$([^$]+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;
const ARGON2_MEMORY_MIN_KIB = 8_192;
const ARGON2_MEMORY_MAX_KIB = 1_048_576;
const ARGON2_TIME_MIN = 1;
const ARGON2_TIME_MAX = 10;
const ARGON2_PARALLELISM_MIN = 1;
const ARGON2_PARALLELISM_MAX = 16;
const ARGON2_HASH_MAX_LENGTH = 1_024;
const passwordService = new PasswordService({
  jwtAccessSecret: "unused",
  jwtRefreshSecret: "unused",
  jwtAccessExpiresSeconds: 900,
  jwtRefreshExpiresSeconds: 604800,
  passwordMinLength: PASSWORD_MIN_LENGTH,
  passwordRequireUppercase: false,
  passwordRequireLowercase: false,
  passwordRequireNumbers: false,
  passwordRequireSpecialChars: false,
  maxSessionsPerUser: 0,
  sessionTimeoutMinutes: 0,
  mfaEnabled: false
});

export function isSupportedArgon2idHash(hash: string): boolean {
  if (hash.length === 0 || hash.length > ARGON2_HASH_MAX_LENGTH) {
    return false;
  }

  const match = ARGON2ID_HASH_PATTERN.exec(hash);
  if (!match) {
    return false;
  }

  const parameters = parseArgon2Parameters(match[1]);
  if (!parameters) {
    return false;
  }

  return (
    isIntegerWithin(parameters.memory, ARGON2_MEMORY_MIN_KIB, ARGON2_MEMORY_MAX_KIB) &&
    isIntegerWithin(parameters.time, ARGON2_TIME_MIN, ARGON2_TIME_MAX) &&
    isIntegerWithin(parameters.parallelism, ARGON2_PARALLELISM_MIN, ARGON2_PARALLELISM_MAX) &&
    isCanonicalUnpaddedBase64(match[2]) &&
    isCanonicalUnpaddedBase64(match[3])
  );
}

export async function verifyLoginPassword(
  user: Pick<User, "passwordHash"> | null,
  password: string,
  verify: (hash: string, plain: string) => Promise<boolean> = argon2.verify
): Promise<boolean> {
  if (!user || !isSupportedArgon2idHash(user.passwordHash)) {
    await verify(DUMMY_PASSWORD_HASH, password);
    return false;
  }

  return verify(user.passwordHash, password);
}

function isCanonicalUnpaddedBase64(value: string): boolean {
  if (value.length === 0 || value.length % 4 === 1) {
    return false;
  }
  try {
    const decoded = Buffer.from(value, "base64");
    return (
      decoded.length > 0 &&
      decoded.toString("base64").replace(/=+$/, "") === value
    );
  } catch {
    return false;
  }
}

function parseArgon2Parameters(
  value: string | undefined
): { memory: number; time: number; parallelism: number } | null {
  if (!value) {
    return null;
  }

  const parsed = new Map<string, number>();
  for (const part of value.split(",")) {
    const match = /^(m|t|p)=([1-9]\d*)$/.exec(part);
    if (!match || parsed.has(match[1])) {
      return null;
    }
    parsed.set(match[1], Number(match[2]));
  }

  const memory = parsed.get("m");
  const time = parsed.get("t");
  const parallelism = parsed.get("p");
  if (
    parsed.size !== 3 ||
    memory === undefined ||
    time === undefined ||
    parallelism === undefined
  ) {
    return null;
  }
  return { memory, time, parallelism };
}

function isIntegerWithin(value: number, minimum: number, maximum: number): boolean {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly mailService: MailService,
    private readonly authRateLimits: AuthRateLimitService,
    private readonly authDeliveryQueue: AuthDeliveryQueueService
  ) {}

  async register(dto: RegisterDto, context: AuthRequestContext): Promise<MessageResponse> {
    await this.authRateLimits.assertRegisterAllowed(context);
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

  async login(
    dto: LoginDto,
    context: AuthRequestContext
  ): Promise<AuthResponse & { refreshToken: string }> {
    await this.authRateLimits.assertLoginAllowed(dto.email, context);
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) }
    });
    const validPassword = await verifyLoginPassword(user, dto.password);
    if (!user || !validPassword || user.status !== UserStatus.ACTIVE) {
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

  async verifyEmail(
    dto: VerifyEmailDto,
    context: AuthRequestContext
  ): Promise<MessageResponse> {
    await this.authRateLimits.assertEmailVerificationAllowed(dto.token, context);
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
    const email = this.normalizeEmail(dto.email);
    if (await this.authRateLimits.allowVerificationResend(email, context)) {
      await this.authDeliveryQueue.enqueueVerificationResend(email, context);
    }
    return { message: RESEND_VERIFICATION_MESSAGE };
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
    context: PasswordRecoveryRequestContext
  ): Promise<MessageResponse> {
    const email = this.normalizeEmail(dto.email);
    if (await this.authRateLimits.allowForgotPassword(email, context)) {
      await this.authDeliveryQueue.enqueuePasswordReset(email, context);
    }
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(
    dto: ResetPasswordDto,
    context: PasswordRecoveryRequestContext
  ): Promise<MessageResponse> {
    await this.authRateLimits.assertResetPasswordAllowed(dto.token, context);
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
    return passwordService.hashPassword(secret);
  }

  private hashResetToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private hashEmailVerificationToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
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
}
