import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MailModule } from "../notifications/mail.module";
import { RateLimitModule } from "../security/rate-limit.module";
import { AuthDeliveryProcessor } from "./auth-delivery.processor";
import { AuthDeliveryQueueService } from "./auth-delivery-queue.service";
import { AuthDeliveryWorker } from "./auth-delivery.worker";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Module({
  imports: [
    JwtModule.register({}),
    RateLimitModule,
    MailModule
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    JwtAuthGuard,
    AuthRateLimitService,
    AuthDeliveryQueueService,
    AuthDeliveryProcessor,
    AuthDeliveryWorker
  ],
  exports: [AuthService, JwtAuthGuard, JwtModule]
})
export class AuthModule {}
