import { areIntervalsOverlapping } from 'date-fns';
import { dayInterval, eventInterval } from '@/lib/events/interval';

/**
 * True if any part of the event occurs within the day.
 * (We treat the event as [start, end) like most calendars.)
 */
export function eventIntersectsDay(e: CalendarEvent, day: Date) {
  const ev = eventInterval(e);
  const d = dayInterval(day);

  return areIntervalsOverlapping(ev, d, { inclusive: false });
}

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => eventIntersectsDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));
}
