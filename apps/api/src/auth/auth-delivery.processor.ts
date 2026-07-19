import { Injectable, Logger } from "@nestjs/common";
import { UserStatus } from "@prisma/client";
import type { Job } from "bullmq";
import { createHash, randomBytes } from "node:crypto";
import { MailDeliveryError, MailService } from "../notifications/mail.service";
import { normalizeNotificationLocale } from "../notifications/templates";
import { PrismaService } from "../prisma/prisma.service";
import type { AuthDeliveryJobData, AuthDeliveryJobName } from "./auth-delivery.types";

@Injectable()
export class AuthDeliveryProcessor {
  private readonly logger = new Logger(AuthDeliveryProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService
  ) {}

  async process(job: Job<AuthDeliveryJobData, void, AuthDeliveryJobName>): Promise<void> {
    if (job.name === "password-reset") {
      await this.processPasswordReset(job.data);
      return;
    }
    await this.processVerificationResend(job.data);
  }

  private async processPasswordReset(data: AuthDeliveryJobData): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user || user.status !== UserStatus.ACTIVE || !user.emailVerifiedAt) {
      return;
    }

    const policy = this.mailService.getPasswordResetPolicy();
    const rawToken = randomBytes(48).toString("base64url");
    const now = new Date();
    const resetToken = await this.prisma.$transaction(async (tx) => {
      await tx.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now }
      });
      return tx.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(now.getTime() + policy.expiresMinutes * 60_000),
          requestedIpHash: data.ipHash,
          userAgentHash: data.userAgentHash ?? null
        }
      });
    });

    const locale = normalizeNotificationLocale(user.locale);
    const resetUrl = new URL(`/${locale}/reset-password`, `${policy.appPublicUrl}/`);
    resetUrl.searchParams.set("token", rawToken);

    try {
      const receipt = await this.mailService.sendPasswordResetEmail({
        recipient: user.email,
        locale,
        resetUrl: resetUrl.toString(),
        expiresInMinutes: policy.expiresMinutes,
        ...(data.requestId ? { requestId: data.requestId } : {})
      });
      await this.markPasswordResetSent(resetToken.id, user.id, policy.expiresMinutes, locale, receipt.messageId);
    } catch (error) {
      await this.revokeFailedPasswordReset(
        resetToken.id,
        user.id,
        error instanceof MailDeliveryError ? error.code : "PASSWORD_RESET_DELIVERY_FAILED"
      );
      throw error;
    }
  }

  private async processVerificationResend(data: AuthDeliveryJobData): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { email: data.email } });
    if (!user || user.status !== UserStatus.ACTIVE || user.emailVerifiedAt) {
      return;
    }

    const policy = this.mailService.getEmailVerificationPolicy();
    const rawToken = randomBytes(48).toString("base64url");
    const now = new Date();
    const token = await this.prisma.$transaction(async (tx) => {
      await tx.emailVerificationToken.updateMany({
        where: { userId: user.id, usedAt: null, revokedAt: null },
        data: { revokedAt: now }
      });
      return tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: this.hashToken(rawToken),
          expiresAt: new Date(now.getTime() + policy.expiresMinutes * 60_000)
        }
      });
    });

    const locale = normalizeNotificationLocale(user.locale);
    const verificationUrl = new URL(`/${locale}/verify-email`, `${policy.appPublicUrl}/`);
    verificationUrl.searchParams.set("token", rawToken);

    try {
      const receipt = await this.mailService.sendEmailVerification({
        recipient: user.email,
        locale,
        verificationUrl: verificationUrl.toString(),
        expiresInMinutes: policy.expiresMinutes,
        ...(data.requestId ? { requestId: data.requestId } : {})
      });
      await this.markVerificationSent(token.id, user.id, policy.expiresMinutes, locale, receipt.messageId);
    } catch (error) {
      await this.revokeFailedVerification(
        token.id,
        user.id,
        error instanceof MailDeliveryError ? error.code : "EMAIL_VERIFICATION_DELIVERY_FAILED"
      );
      throw error;
    }
  }

  private async markPasswordResetSent(
    tokenId: string,
    userId: string,
    expiresMinutes: number,
    locale: string,
    messageId: string
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.passwordResetToken.updateMany({
        where: { id: tokenId, sentAt: null, usedAt: null, revokedAt: null },
        data: { sentAt: new Date() }
      });
      if (marked.count !== 1) {
        throw new Error("Password reset token could not be marked as sent");
      }
      await tx.authAuditLog.create({
        data: {
          userId,
          event: "password_reset_requested",
          success: true,
          metadata: { expiresMinutes, locale, messageId }
        }
      });
    });
  }

  private async markVerificationSent(
    tokenId: string,
    userId: string,
    expiresMinutes: number,
    locale: string,
    messageId: string
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const marked = await tx.emailVerificationToken.updateMany({
        where: { id: tokenId, sentAt: null, usedAt: null, revokedAt: null },
        data: { sentAt: new Date() }
      });
      if (marked.count !== 1) {
        throw new Error("Email verification token could not be marked as sent");
      }
      await tx.authAuditLog.create({
        data: {
          userId,
          event: "email_verification_sent",
          success: true,
          metadata: { source: "resend", expiresMinutes, locale, messageId }
        }
      });
    });
  }

  private async revokeFailedPasswordReset(
    tokenId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.revokeFailedToken("password", tokenId, userId, reason);
  }

  private async revokeFailedVerification(
    tokenId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    await this.revokeFailedToken("verification", tokenId, userId, reason);
  }

  private async revokeFailedToken(
    kind: "password" | "verification",
    tokenId: string,
    userId: string,
    reason: string
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        if (kind === "password") {
          await tx.passwordResetToken.updateMany({
            where: { id: tokenId, usedAt: null, revokedAt: null },
            data: { revokedAt: new Date() }
          });
        } else {
          await tx.emailVerificationToken.updateMany({
            where: { id: tokenId, usedAt: null, revokedAt: null },
            data: { revokedAt: new Date() }
          });
        }
        await tx.authAuditLog.create({
          data: {
            userId,
            event: kind === "password" ? "password_reset_failed" : "email_verification_failed",
            success: false,
            metadata: { reason }
          }
        });
      });
    } catch {
      this.logger.error(
        JSON.stringify({
          event: "auth_delivery_state_failed",
          kind,
          userId,
          reason: "TOKEN_REVOCATION_FAILED"
        })
      );
    }
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }
}
