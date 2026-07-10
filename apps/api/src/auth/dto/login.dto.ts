import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MinLength } from "class-validator";

export class LoginDto {
  @ApiProperty({ example: "ada@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8, example: "correct horse battery staple" })
  @IsString()
  @MinLength(8)
  password!: string;
}
