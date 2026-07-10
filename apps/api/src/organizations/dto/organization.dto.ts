import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { OrganizationMembershipStatus, OrganizationRole, OrganizationStatus } from "@prisma/client";
import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from "class-validator";
import type { Permission } from "../permissions";

export class CreateOrganizationDto {
  @ApiProperty({ example: "Kaklen Demo" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ example: "Kaklen Demo SpA" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string;

  @ApiPropertyOptional({ example: "76123456-7" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: "Kaklen Demo" })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ example: "Kaklen Demo SpA" })
  @IsOptional()
  @IsString()
  @MaxLength(160)
  legalName?: string | null;

  @ApiPropertyOptional({ example: "76123456-7" })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  taxId?: string | null;
}

export class InviteMemberDto {
  @ApiProperty({ example: "member@example.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: OrganizationRole, example: OrganizationRole.MEMBER })
  @IsEnum(OrganizationRole)
  role!: OrganizationRole;
}

export class UpdateMembershipDto {
  @ApiPropertyOptional({ enum: OrganizationRole, example: OrganizationRole.MANAGER })
  @IsOptional()
  @IsEnum(OrganizationRole)
  role?: OrganizationRole;

  @ApiPropertyOptional({
    enum: OrganizationMembershipStatus,
    example: OrganizationMembershipStatus.ACTIVE
  })
  @IsOptional()
  @IsEnum(OrganizationMembershipStatus)
  status?: OrganizationMembershipStatus;
}

export class AcceptInvitationDto {
  @ApiProperty({ example: "invitation-token" })
  @IsString()
  @MinLength(20)
  token!: string;
}

export class OrganizationResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty({ nullable: true })
  legalName!: string | null;

  @ApiProperty({ nullable: true })
  taxId!: string | null;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  timezone!: string;

  @ApiProperty({ enum: OrganizationStatus })
  status!: OrganizationStatus;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class OrganizationMemberDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  firstName!: string;

  @ApiProperty()
  lastName!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty({ enum: OrganizationMembershipStatus })
  status!: OrganizationMembershipStatus;

  @ApiProperty()
  joinedAt!: string;
}

export class OrganizationInvitationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: OrganizationRole })
  role!: OrganizationRole;

  @ApiProperty()
  expiresAt!: string;

  @ApiProperty({ nullable: true })
  acceptedAt!: string | null;

  @ApiProperty({ nullable: true })
  revokedAt!: string | null;

  @ApiPropertyOptional({ description: "Only returned outside production for MVP testing." })
  invitationToken?: string;
}

export class PermissionsResponseDto {
  @ApiProperty({ isArray: true, example: ["organization.read", "clients.read"] })
  permissions!: Permission[];
}
