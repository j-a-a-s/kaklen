import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional, IsString, Matches, MaxLength } from "class-validator";

export class PrepareWhatsAppNotificationDto {
  @ApiProperty({ description: "Token público de la cotización", minLength: 40, maxLength: 80 })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{40,80}$/)
  publicToken!: string;

  @ApiPropertyOptional({ enum: ["es", "en", "pt-BR"], default: "es" })
  @IsOptional()
  @IsIn(["es", "en", "pt-BR"])
  locale?: "es" | "en" | "pt-BR";
}

export class WhatsAppProviderCallbackDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  providerMessageId!: string;

  @ApiProperty({ enum: ["SENT", "FAILED", "OPENED"] })
  @IsIn(["SENT", "FAILED", "OPENED"])
  status!: "SENT" | "FAILED" | "OPENED";
}
