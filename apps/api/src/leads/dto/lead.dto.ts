import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Transform, type TransformFnParams } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  MinLength
} from "class-validator";
import { VALIDATION_LIMITS } from "@kaklen/shared";

const PERSON_NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M}' -]*$/u;
const SAFE_SINGLE_LINE_PATTERN = /^[^\u0000-\u001f\u007f<>]*$/u;
const SAFE_MULTILINE_PATTERN = /^[^\u0000-\u0008\u000b-\u001f\u007f]*$/u;
const PHONE_PATTERN = /^[0-9()+. -]+$/u;
const RELATIVE_PATH_PATTERN = /^\/(?!\/)[^\u0000-\u001f\u007f]*$/u;

export const LEAD_INTEREST_TYPES = [
  "ADVISORY",
  "KAKLEN",
  "PLATFORM_DEVELOPMENT",
  "DIGITAL_TRANSFORMATION",
  "INVESTMENT_PARTNERSHIP",
  "KAPIAR",
  "OTHER"
] as const;

export type LeadInterestType = (typeof LEAD_INTEREST_TYPES)[number];

export class CreateLeadDto {
  @ApiProperty({ maxLength: VALIDATION_LIMITS.shortName })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(VALIDATION_LIMITS.shortName)
  @Matches(PERSON_NAME_PATTERN)
  firstName!: string;

  @ApiProperty({ maxLength: VALIDATION_LIMITS.shortName })
  @Transform(trimString)
  @IsString()
  @MinLength(2)
  @MaxLength(VALIDATION_LIMITS.shortName)
  @Matches(PERSON_NAME_PATTERN)
  lastName!: string;

  @ApiProperty({ maxLength: VALIDATION_LIMITS.email })
  @Transform(trimString)
  @IsEmail()
  @MaxLength(VALIDATION_LIMITS.email)
  email!: string;

  @ApiProperty({ description: "ISO 3166-1 alpha-2 country code, e.g. CL", example: "CL" })
  @Transform(trimString)
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/u)
  phoneCountryCode!: string;

  @ApiProperty({ maxLength: VALIDATION_LIMITS.phone })
  @Transform(trimString)
  @IsString()
  @MinLength(6)
  @MaxLength(VALIDATION_LIMITS.phone)
  @Matches(PHONE_PATTERN)
  phone!: string;

  @ApiPropertyOptional({ maxLength: VALIDATION_LIMITS.name })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.name)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  company?: string;

  @ApiPropertyOptional({ maxLength: VALIDATION_LIMITS.name })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.name)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  position?: string;

  @ApiPropertyOptional({ maxLength: VALIDATION_LIMITS.name })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(VALIDATION_LIMITS.name)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  country?: string;

  @ApiProperty({ enum: LEAD_INTEREST_TYPES })
  @IsIn(LEAD_INTEREST_TYPES)
  interestType!: LeadInterestType;

  @ApiProperty({ maxLength: VALIDATION_LIMITS.note })
  @Transform(trimString)
  @IsString()
  @MinLength(10)
  @MaxLength(VALIDATION_LIMITS.note)
  @Matches(SAFE_MULTILINE_PATTERN)
  message!: string;

  @ApiProperty()
  @IsBoolean()
  privacyConsent!: boolean;

  @ApiProperty()
  @IsBoolean()
  whatsappConsent!: boolean;

  @ApiPropertyOptional({ description: "Honeypot field; must stay empty for genuine submissions." })
  @IsOptional()
  @IsString()
  @MaxLength(0)
  website?: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(RELATIVE_PATH_PATTERN)
  landingPage?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  @IsUrl({ protocols: ["http", "https"], require_protocol: true, require_tld: false })
  referrer?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  utmSource?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  utmMedium?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  utmCampaign?: string;

  @ApiPropertyOptional({ maxLength: 120 })
  @Transform(trimString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Matches(SAFE_SINGLE_LINE_PATTERN)
  utmContent?: string;
}

export class LeadWhatsAppResponseDto {
  @ApiProperty()
  scheduled!: boolean;
}

export class CreateLeadResponseDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ format: "uuid" })
  @IsUUID()
  leadReference!: string;

  @ApiProperty({ type: LeadWhatsAppResponseDto })
  whatsapp!: LeadWhatsAppResponseDto;
}

function trimString({ value }: TransformFnParams): unknown {
  return typeof value === "string" ? value.trim() : value;
}
