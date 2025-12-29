import { addDays, areIntervalsOverlapping, parseISO, startOfDay } from 'date-fns';

export function eventInterval(e: CalendarEvent) {
  return { start: parseISO(e.start), end: parseISO(e.end) };
}

export function dayInterval(day: Date) {
  const start = startOfDay(day);
  const end = addDays(start, 1);
  return { start, end };
}

/**
 * True if any part of the event occurs within the day.
 * (We treat the event as [start, end) like most calendars.)
 */
export function eventIntersectsDay(e: CalendarEvent, day: Date) {
  const ev = eventInterval(e);
  const d = dayInterval(day);

  return areIntervalsOverlapping(ev, d, { inclusive: false });
}
