import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateQuotationPublicLinkDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 720, default: 168 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(720)
  expiresInHours?: number;

  @ApiPropertyOptional({ enum: ["es", "en", "pt-BR"], default: "es" })
  @IsOptional()
  @IsIn(["es", "en", "pt-BR"])
  locale?: "es" | "en" | "pt-BR";
}

export class RequestQuotationChangesDto {
  @ApiProperty({ minLength: 5, maxLength: 2000 })
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  comment!: string;

  @ApiPropertyOptional({ type: Number, isArray: true, description: "Índices visibles de líneas relacionadas." })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @Type(() => Number)
  @IsInt({ each: true })
  @Min(0, { each: true })
  itemIndexes?: number[];
}

export class ProviderRecommendationSeenDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  shown!: boolean;
}
