import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";

export class VerifyEmailDto {
  @ApiProperty({
    description: "Single-use token received by email",
    example: "VZiJzb9vM8q1H6vBCcXjR4fbz0QJ2dNWbA8YxFqzM1A"
  })
  @IsString()
  @MinLength(32)
  @MaxLength(256)
  token!: string;
}

export class ResendVerificationEmailDto {
  @ApiProperty({ example: "ada@example.com" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
