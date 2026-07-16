import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { QuotationDiscountType, QuotationItemType, QuotationStatus } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested
} from "class-validator";

export class QuotationItemInputDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  catalogItemId?: string;

  @ApiProperty({ enum: QuotationItemType, example: QuotationItemType.PRODUCT })
  @IsEnum(QuotationItemType)
  type!: QuotationItemType;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @ApiProperty({ maxLength: 160 })
  @IsString()
  @MaxLength(160)
  name!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiProperty({ minimum: 0.001, example: 2 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  quantity!: number;

  @ApiProperty({ maxLength: 40, example: "unidad" })
  @IsString()
  @MaxLength(40)
  unit!: string;

  @ApiProperty({ minimum: 0, example: 25000 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @ApiPropertyOptional({ enum: QuotationDiscountType, default: QuotationDiscountType.NONE })
  @IsOptional()
  @IsEnum(QuotationDiscountType)
  discountType?: QuotationDiscountType;

  @ApiPropertyOptional({ minimum: 0, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  discountValue?: number;

  @ApiProperty({ minimum: 0, maximum: 100, example: 19 })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  taxPercent!: number;
}

export class CreateQuotationDto {
  @ApiProperty({ format: "uuid" })
  @IsUUID()
  clientId!: string;

  @ApiProperty({ format: "date", example: "2026-07-10" })
  @IsDateString()
  issueDate!: string;

  @ApiProperty({ format: "date", example: "2026-08-10" })
  @IsDateString()
  validUntil!: string;

  @ApiPropertyOptional({ maxLength: 3, example: "CLP" })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 5, default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  globalDiscountPercent?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string;

  @ApiProperty({ type: QuotationItemInputDto, isArray: true })
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  items!: QuotationItemInputDto[];
}

export class UpdateQuotationDto {
  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  issueDate?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  validUntil?: string;

  @ApiPropertyOptional({ maxLength: 3 })
  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100)
  globalDiscountPercent?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  terms?: string | null;

  @ApiPropertyOptional({ type: QuotationItemInputDto, isArray: true })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => QuotationItemInputDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  items?: QuotationItemInputDto[];
}

export class ListQuotationsQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;

  @ApiPropertyOptional({ enum: QuotationStatus })
  @IsOptional()
  @IsEnum(QuotationStatus)
  status?: QuotationStatus;

  @ApiPropertyOptional({ format: "uuid" })
  @IsOptional()
  @IsUUID()
  clientId?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  issueDateFrom?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  issueDateTo?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  validUntilFrom?: string;

  @ApiPropertyOptional({ format: "date" })
  @IsOptional()
  @IsDateString()
  validUntilTo?: string;

  @ApiPropertyOptional({ enum: ["createdAt", "issueDate", "validUntil", "total", "number"], default: "createdAt" })
  @IsOptional()
  @IsEnum(["createdAt", "issueDate", "validUntil", "total", "number"])
  sortBy?: "createdAt" | "issueDate" | "validUntil" | "total" | "number";

  @ApiPropertyOptional({ enum: ["asc", "desc"], default: "desc" })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortDirection?: "asc" | "desc";

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}

export class ChangeQuotationStatusDto {
  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class SendQuotationEmailDto {
  @ApiProperty({ format: "email", maxLength: 254, example: "cliente@empresa.cl" })
  @IsEmail()
  @MaxLength(254)
  to!: string;

  @ApiProperty({ minLength: 1, maxLength: 200, example: "Cotización QUO-000001" })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject!: string;

  @ApiProperty({ minLength: 1, maxLength: 5000, example: "Adjuntamos nuestra propuesta comercial." })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  message!: string;

  @ApiPropertyOptional({ enum: ["es", "en", "pt-BR"], default: "es" })
  @IsOptional()
  @IsIn(["es", "en", "pt-BR"])
  locale?: "es" | "en" | "pt-BR";
}
