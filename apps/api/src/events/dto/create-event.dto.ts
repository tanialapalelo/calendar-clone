import {
  IsBoolean,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  IsArray,
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

  /**
   * Timed events:
   * - required
   * All-day events:
   * - still accepted for backward compatibility
   * - will be normalized to midnight boundaries using timeZone/recurrenceTimeZone
   */
  @IsISO8601()
  startAt!: string;

  @IsISO8601()
  endAt!: string;

  /**
   * All-day events (preferred, Google-like):
   * date-only string in YYYY-MM-DD
   * endDate is exclusive (like Google Calendar)
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
  calendarId?: string;

  @IsOptional()
  @IsString()
  color?: string;

  /**
   * Rule-only RRULE string (no "RRULE:" prefix), e.g.:
   * "FREQ=WEEKLY;BYDAY=TU" or "FREQ=WEEKLY;BYDAY=TU;COUNT=10"
   */
  @IsOptional()
  @IsString()
  recurrenceRule?: string | null;

  @IsOptional()
  @IsString()
  recurrenceTimeZone?: string;

  @IsOptional()
  @IsArray()
  guests?: string[];

  @IsOptional()
  @IsArray()
  notifications?: Record<string, unknown>[];

  @IsOptional()
  @IsString()
  visibility?: string;

  @IsOptional()
  @IsString()
  busyStatus?: string;
}
