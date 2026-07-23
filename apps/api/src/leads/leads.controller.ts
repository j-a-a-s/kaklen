import { Body, Controller, Header, Headers, Post, Req } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import { CreateLeadDto, CreateLeadResponseDto } from "./dto/lead.dto";
import { LeadsService } from "./leads.service";

// ThrottlerGuard is already registered globally as APP_GUARD (see
// security/distributed-throttling.module.ts) — adding it again here via
// @UseGuards would run canActivate() twice per request and silently halve
// the @Throttle limit below.
@ApiTags("leads")
@Controller("leads")
export class LeadsController {
  constructor(private readonly leads: LeadsService) {}

  @Post()
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Header("Referrer-Policy", "no-referrer")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Registrar un lead desde el sitio de marketing" })
  @ApiCreatedResponse({ type: CreateLeadResponseDto })
  @ApiBadRequestResponse({ description: "Payload or consent is invalid." })
  @ApiTooManyRequestsResponse({ description: "The per-IP submission limit was exceeded." })
  @ApiServiceUnavailableResponse({ description: "The distributed rate-limit backend is unavailable." })
  async create(
    @Body() dto: CreateLeadDto,
    @Headers("user-agent") userAgent: string | undefined,
    @Req() request: Request
  ): Promise<CreateLeadResponseDto> {
    const result = await this.leads.create(dto, {
      ipAddress: request.ip,
      userAgent
    });
    return {
      success: true,
      leadReference: result.leadReference,
      whatsapp: result.whatsapp
    };
  }
}
