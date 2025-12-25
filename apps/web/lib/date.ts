import { format, isValid, parseISO } from 'date-fns';

/**
 * We store dates in the URL as YYYY-MM-DD (ISO date without time).
 * parseISO understands this format well and returns a Date in local time.
 */
export function parseIsoDateOrToday(value: string | null): Date {
  if (!value) return new Date();
  const d = parseISO(value);
  return isValid(d) ? d : new Date();
}

export function formatIsoDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}
