import { differenceInMinutes, parseISO, startOfDay } from 'date-fns';

export function minutesSinceStartOfDay(iso: string, day: Date) {
  return differenceInMinutes(parseISO(iso), startOfDay(day));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function eventsForDayLayout(events: CalendarEvent[], day: Date) {
  return events
    .filter((e) => {
      // event belongs to the day of its start time
      const start = parseISO(e.start);
      return (
        start >= startOfDay(day) &&
        start < new Date(startOfDay(day).getTime() + 24 * 60 * 60 * 1000)
      );
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
