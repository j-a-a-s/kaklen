import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class GlobalSearchQueryDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120, example: "comercial andes" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  query!: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 10, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10)
  limit?: number;
}

export class ActivityQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 30, default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  limit?: number;
}
