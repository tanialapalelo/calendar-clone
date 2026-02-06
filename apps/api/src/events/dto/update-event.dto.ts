import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class UpdateEventDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsBoolean()
  allDay?: boolean;

  @IsOptional()
  @IsISO8601()
  startAt?: string;

  @IsOptional()
  @IsISO8601()
  endAt?: string;

  /**
   * All-day events (preferred):
   * date-only string in YYYY-MM-DD, endDate exclusive.
   */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  startDate?: string;

  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  endDate?: string;

  @IsOptional()
  @IsString()
  timeZone?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /**
   * Rule-only RRULE string (no "RRULE:" prefix). Use null to clear recurrence.
   */
  @IsOptional()
  @IsString()
  recurrenceRule?: string | null;

  @IsOptional()
  @IsString()
  recurrenceTimeZone?: string;
}
