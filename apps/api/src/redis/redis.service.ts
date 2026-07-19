import { Injectable, type BeforeApplicationShutdown } from "@nestjs/common";
import { readRedisConfig, type RedisConfig } from "@kaklen/config";
import Redis, { type RedisOptions } from "ioredis";

@Injectable()
export class RedisService implements BeforeApplicationShutdown {
  readonly config: RedisConfig;
  readonly client: Redis;

  constructor() {
    this.config = readRedisConfig(process.env);
    this.client = new Redis(this.config.url, this.commandOptions());
    this.client.on("error", () => undefined);
  }

  workerOptions(): RedisOptions {
    return {
      ...this.connectionOptions(),
      maxRetriesPerRequest: null,
      retryStrategy: (attempt) => Math.min(attempt * 250, 2000)
    };
  }

  async ping(): Promise<void> {
    const result = await this.client.ping();
    if (result !== "PONG") {
      throw new Error("Redis did not return PONG");
    }
  }

  async beforeApplicationShutdown(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    if (this.client.status === "end") {
      return;
    }
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect(false);
    }
  }

  private commandOptions(): RedisOptions {
    return {
      ...this.connectionOptions(),
      commandTimeout: 2000,
      maxRetriesPerRequest: 1,
      retryStrategy: (attempt) => Math.min(attempt * 100, 1000)
    };
  }

  private connectionOptions(): RedisOptions {
    const parsed = new URL(this.config.url);
    const database = parsed.pathname.length > 1 ? Number(parsed.pathname.slice(1)) : 0;
    return {
      host: parsed.hostname,
      port: Number(parsed.port || 6379),
      db: Number.isInteger(database) ? database : 0,
      ...(parsed.username ? { username: decodeURIComponent(parsed.username) } : {}),
      ...(parsed.password ? { password: decodeURIComponent(parsed.password) } : {}),
      ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
      connectTimeout: 1500,
      enableOfflineQueue: true,
      lazyConnect: true
    };
  }
}
