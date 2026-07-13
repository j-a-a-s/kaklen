import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@kaklen/shared";
import { readApiConfig } from "@kaklen/config";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  getHealth(): HealthResponse {
    return this.base("ok");
  }

  getLive(): HealthResponse {
    return this.base("ok");
  }

  async getReady(): Promise<HealthResponse> {
    await Promise.race([
      this.prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Database readiness check timed out")), 1500);
      })
    ]);
    return this.base("ok");
  }

  getNotReady(): HealthResponse {
    return this.base("error");
  }

  private base(status: HealthResponse["status"]): HealthResponse {
    const config = readApiConfig(process.env);
    return {
      status,
      service: "kaklen-api",
      version: config.appVersion,
      commitSha: config.commitSha,
      buildTime: config.buildTime,
      timestamp: new Date().toISOString()
    };
  }
}
