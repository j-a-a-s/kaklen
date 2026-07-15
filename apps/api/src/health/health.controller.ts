import { Controller, Get, HttpStatus, Res } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import type { HealthResponse } from "@kaklen/shared";
import { HealthService } from "./health.service";

@ApiTags("health")
@Controller("health")
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @ApiOkResponse({
    description: "API health status",
    schema: {
      example: {
        status: "ok",
        service: "kaklen-api",
        version: "0.1.0",
        commitSha: "local",
        buildTime: "2026-07-09T00:00:00.000Z",
        environment: "development",
        timestamp: "2026-07-09T00:00:00.000Z",
        checks: {
          database: "unknown"
        }
      }
    }
  })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }

  @Get("live")
  @ApiOkResponse({ description: "Process liveness status" })
  getLive(): HealthResponse {
    return this.healthService.getLive();
  }

  @Get("ready")
  @ApiOkResponse({ description: "Database readiness status" })
  async getReady(@Res({ passthrough: true }) response: Response): Promise<HealthResponse> {
    try {
      return await this.healthService.getReady();
    } catch {
      response.status(HttpStatus.SERVICE_UNAVAILABLE);
      return this.healthService.getNotReady();
    }
  }
}
