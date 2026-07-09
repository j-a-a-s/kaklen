import { Controller, Get } from "@nestjs/common";
import { ApiOkResponse, ApiTags } from "@nestjs/swagger";
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
        timestamp: "2026-07-09T00:00:00.000Z"
      }
    }
  })
  getHealth(): HealthResponse {
    return this.healthService.getHealth();
  }
}
