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
  // gunakan interval [start, end) untuk menentukan apakah event menyentuh hari ini,
  // lalu urutkan dengan aturan yang konsisten: cross-day timed dulu, lalu all-day, lalu timed biasa.
  return events
    .filter((event) => eventIntersectsDay(event, day))
    .sort((a, b) => {
      const aStart = new Date(a.start);
      const aEnd = new Date(a.end);
      const bStart = new Date(b.start);
      const bEnd = new Date(b.end);

      const aCross = !a.allDay && aStart.getDate() !== aEnd.getDate() && eventIntersectsDay(a, day);
      const bCross = !b.allDay && bStart.getDate() !== bEnd.getDate() && eventIntersectsDay(b, day);

      if (aCross && !bCross) return -1;
      if (!aCross && bCross) return 1;

      if (a.allDay && !b.allDay) return -1;
      if (!a.allDay && b.allDay) return 1;

      return aStart.getTime() - bStart.getTime();
    });
}
