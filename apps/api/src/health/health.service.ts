import { Injectable } from "@nestjs/common";
import type { HealthResponse } from "@kaklen/shared";

@Injectable()
export class HealthService {
  getHealth(): HealthResponse {
    return {
      status: "ok",
      service: "kaklen-api",
      timestamp: new Date().toISOString()
    };
  }
}
