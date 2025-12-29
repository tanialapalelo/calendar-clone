import { addDays, differenceInMinutes, max, min, parseISO, startOfDay } from 'date-fns';
import { eventIntersectsDay } from './interval';

export function clamp(n: number, minN: number, maxN: number) {
  return Math.max(minN, Math.min(maxN, n));
}

export function dayBounds(day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return { start, end };
}

export function eventsForDayLayout(events: CalendarEvent[], day: Date) {
  return events
    .filter((e) => eventIntersectsDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));
}

export function eventMinutesWithinDay(e: CalendarEvent, day: Date) {
  const { start: dayStart, end: dayEnd } = dayBounds(day);
  const evStart = parseISO(e.start);
  const evEnd = parseISO(e.end);

  const start = max([evStart, dayStart]);
  const end = min([evEnd, dayEnd]);

  const startMin = clamp(differenceInMinutes(start, dayStart), 0, 24 * 60);
  const endMin = clamp(differenceInMinutes(end, dayStart), 0, 24 * 60);

  return { startMin, endMin };
}
