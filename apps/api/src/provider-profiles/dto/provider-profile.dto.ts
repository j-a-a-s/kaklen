import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  Equals,
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export class CreateProviderProfileDto {
  @ApiProperty({ example: true, description: "Consentimiento explícito para reutilizar datos confirmados" })
  @IsBoolean()
  @Equals(true)
  consent!: true;

  @ApiProperty({ maxLength: 80, example: "Fotografía" })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  category!: string;

  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ enum: ["CL", "AR", "BR", "MX", "US"] })
  @IsIn(["CL", "AR", "BR", "MX", "US"])
  country!: "CL" | "AR" | "BR" | "MX" | "US";

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  region?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  city?: string;

  @ApiProperty({ maxLength: 24, example: "+56912345678" })
  @IsString()
  @MaxLength(24)
  whatsapp!: string;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  price?: number;

  @ApiProperty({ maxLength: 3, example: "CLP" })
  @IsString()
  @MaxLength(3)
  currency!: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ["http", "https"] })
  @MaxLength(500)
  portfolioUrl?: string;
}

export class ReviewProviderProfileDto {
  @ApiProperty({ enum: ["PUBLISHED", "ARCHIVED"] })
  @IsIn(["PUBLISHED", "ARCHIVED"])
  status!: "PUBLISHED" | "ARCHIVED";
}
