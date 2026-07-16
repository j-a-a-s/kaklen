import { ApiProperty } from "@nestjs/swagger";
import type { AuthResponse, AuthUser } from "@kaklen/shared";

export class AuthUserDto implements AuthUser {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ example: "ada@example.com" })
  email!: string;

  @ApiProperty({ example: "Ada" })
  firstName!: string;

  @ApiProperty({ example: "Lovelace" })
  lastName!: string;

  @ApiProperty({ enum: ["es", "en", "pt-BR"], example: "es" })
  locale!: string;

  @ApiProperty({ enum: ["ACTIVE", "INACTIVE", "SUSPENDED", "ARCHIVED"] })
  status!: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "ARCHIVED";

  @ApiProperty({ format: "date-time", nullable: true })
  emailVerifiedAt!: string | null;

  @ApiProperty({ format: "date-time" })
  createdAt!: string;

  @ApiProperty({ format: "date-time" })
  updatedAt!: string;
}

export class AuthResponseDto implements AuthResponse {
  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;

  @ApiProperty({ description: "JWT access token valid for 15 minutes" })
  accessToken!: string;
}

export class MessageResponseDto {
  @ApiProperty({ example: "Logged out" })
  message!: string;
}
