import { Global, Module } from "@nestjs/common";
import { RedisModule } from "../redis/redis.module";
import { DistributedRateLimitService } from "./distributed-rate-limit.service";
import { RedisThrottlerStorage } from "./redis-throttler.storage";

@Global()
@Module({
  imports: [RedisModule],
  providers: [DistributedRateLimitService, RedisThrottlerStorage],
  exports: [DistributedRateLimitService, RedisThrottlerStorage, RedisModule]
})
export class RateLimitModule {}
