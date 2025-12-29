import { eventIntersectsDay } from './interval';

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => eventIntersectsDay(e, day))
    .sort((a, b) => a.start.localeCompare(b.start));
}
