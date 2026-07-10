import { ApiProperty } from "@nestjs/swagger";
import { IsIn } from "class-validator";

export const SUPPORTED_LOCALES = ["es", "en", "pt-BR"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export class UpdatePreferencesDto {
  @ApiProperty({ enum: SUPPORTED_LOCALES, example: "pt-BR" })
  @IsIn(SUPPORTED_LOCALES)
  locale!: SupportedLocale;
}
