import { isSameDay, parseISO } from 'date-fns';

export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((event) => isSameDay(parseISO(event.start), day))
    .sort((a, b) => a.start.localeCompare(b.start));
}
