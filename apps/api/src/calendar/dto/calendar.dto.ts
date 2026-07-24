import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, IsUUID } from "class-validator";

export class ConnectCalendarDto {
  @ApiProperty({ description: "OAuth authorization code from Google" })
  @IsString()
  code!: string;

  @ApiPropertyOptional({ description: "Calendar ID to sync (defaults to primary)" })
  @IsOptional()
  @IsString()
  calendarId?: string;
}

export class SyncEventDto {
  @ApiProperty({ description: "Event ID to sync to external calendar" })
  @IsUUID()
  eventId!: string;
}

export class DisconnectCalendarDto {
  @ApiProperty({ description: "Calendar integration ID to disconnect" })
  @IsUUID()
  integrationId!: string;
}
