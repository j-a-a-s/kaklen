import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from "class-validator";

export class CreatePublicPaymentDto {
  @ApiProperty({ format: "uuid", description: "Clave estable para reintentos idempotentes" })
  @IsUUID()
  idempotencyKey!: string;

  @ApiPropertyOptional({ enum: ["es", "en", "pt-BR"], default: "es" })
  @IsOptional()
  @IsIn(["es", "en", "pt-BR"])
  locale?: "es" | "en" | "pt-BR";
}

export class CompleteSandboxPaymentDto {
  @ApiProperty({ enum: ["PAID", "FAILED"] })
  @IsIn(["PAID", "FAILED"])
  outcome!: "PAID" | "FAILED";
}

export class SandboxWebhookDto {
  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  eventId!: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  externalReference!: string;

  @ApiProperty({ enum: ["PROCESSING", "PAID", "FAILED", "CANCELLED"] })
  @IsIn(["PROCESSING", "PAID", "FAILED", "CANCELLED"])
  status!: "PROCESSING" | "PAID" | "FAILED" | "CANCELLED";

  @ApiProperty({ example: "119000.00" })
  @IsString()
  @MaxLength(32)
  amount!: string;

  @ApiProperty({ example: "CLP", maxLength: 3 })
  @IsString()
  @MaxLength(3)
  currency!: string;
}

export class RefundPaymentDto {
  @ApiProperty({ minimum: 0.01 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
