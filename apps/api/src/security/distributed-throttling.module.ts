import { Global, Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { RateLimitModule } from "./rate-limit.module";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  imports: [
    RateLimitModule,
    ThrottlerModule.forRootAsync({
      imports: [RateLimitModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        storage,
        throttlers: [{ ttl: 60_000, limit: 100 }]
      })
    })
  ],
  exports: [RateLimitModule, ThrottlerModule]
})
export class DistributedThrottlingModule {}
