import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import { PASSWORD_MIN_LENGTH } from "@kaklen/shared";

export class RegisterDto {
  @ApiProperty({ example: "ada@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Ada", maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ example: "Lovelace", maxLength: 80 })
  @IsString()
  @MinLength(1)
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({ minLength: PASSWORD_MIN_LENGTH, example: "correct horse battery staple" })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @MaxLength(128)
  password!: string;

  @ApiProperty({ enum: ["es", "en", "pt-BR"], default: "es", required: false })
  @IsOptional()
  @IsIn(["es", "en", "pt-BR"])
  locale?: "es" | "en" | "pt-BR";
}
