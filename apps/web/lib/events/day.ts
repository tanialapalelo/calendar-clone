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
  return (
    events
      .filter((e) => eventIntersectsDay(e, day))
      // cross-day first, then all-day, then start time
      .sort((a, b) => {
        const aCross =
          !a.allDay &&
          eventIntersectsDay(a, day) &&
          new Date(a.start).getDate() !== new Date(a.end).getDate();
        const bCross =
          !b.allDay &&
          eventIntersectsDay(b, day) &&
          new Date(b.start).getDate() !== new Date(b.end).getDate();
        if (aCross && !bCross) return -1;
        if (!aCross && bCross) return 1;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        return new Date(a.start).getTime() - new Date(b.start).getTime();
      })
  );
}
