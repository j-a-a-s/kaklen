import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule } from "@nestjs/throttler";
import { MailModule } from "../notifications/mail.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { EmailVerificationRateLimitService } from "./email-verification-rate-limit.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { PasswordRecoveryRateLimitService } from "./password-recovery-rate-limit.service";

@Module({
  imports: [
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    MailModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    PasswordRecoveryRateLimitService,
    EmailVerificationRateLimitService
  ],
  exports: [AuthService, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
