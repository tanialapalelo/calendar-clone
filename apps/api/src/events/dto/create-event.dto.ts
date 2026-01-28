import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsISO8601()
  startAt!: string; // ISO string

  @IsISO8601()
  endAt!: string; // ISO string

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  calendarId?: string; // if omitted, use default calendar
}
