'use strict';

import { RRule } from 'rrule';
import { parseISO, addDays, startOfDay, areIntervalsOverlapping } from 'date-fns';
import { eventInterval } from '@/lib/events/interval';

export type RecurringOccurrenceEvent = CalendarEvent & {
  isOccurrence: true;
  originalEventId: string;
};

export function getSeriesOpenId(ev: CalendarEvent | RecurringOccurrenceEvent): string {
  const anyEv = ev as CalendarEvent & { originalEventId?: string };
  return anyEv.originalEventId ?? anyEv.id;
}

/**
 * Expand recurring events into concrete instances within the given [windowStart, windowEnd).
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  windowStart: Date,
  windowEnd: Date,
): (CalendarEvent | RecurringOccurrenceEvent)[] {
  const out: (CalendarEvent | RecurringOccurrenceEvent)[] = [];

  const winStart = windowStart;
  const winEnd = windowEnd;

  for (const ev of events) {
    // Non-recurring event
    if (!ev.recurrence) {
      const evInt = eventInterval(ev);
      const winInt = { start: windowStart, end: windowEnd }; // [start, end)

      if (areIntervalsOverlapping(evInt, winInt, { inclusive: false })) {
        out.push(ev);
      }
      continue;
    }

    try {
      const origStart = parseISO(ev.start);
      const origEnd = parseISO(ev.end);
      const durationMs = origEnd.getTime() - origStart.getTime();

      const opts = RRule.parseString(ev.recurrence);

      if (ev.allDay) {
        // For all-day events, anchor dtstart to local midnight of the logical start date.
        const anchor = startOfDay(origStart);
        opts.dtstart = anchor;
      } else {
        // For timed events, keep the local Y/M/D/H/M/S anchor.
        opts.dtstart = new Date(
          origStart.getFullYear(),
          origStart.getMonth(),
          origStart.getDate(),
          origStart.getHours(),
          origStart.getMinutes(),
          origStart.getSeconds(),
          origStart.getMilliseconds(),
        );
      }

      const rule = new RRule(opts);

      const occDates = rule.between(winStart, winEnd, true);

      for (const occ of occDates) {
        let occStart: Date;
        let occEnd: Date;

        if (ev.allDay) {
          const d = startOfDay(occ);
          occStart = d;
          occEnd = addDays(d, 1);
        } else {
          // Timed: preserve duration dan offset lokal
          const base = new Date(
            occ.getFullYear(),
            occ.getMonth(),
            occ.getDate(),
            occ.getHours(),
            occ.getMinutes(),
            occ.getSeconds(),
            occ.getMilliseconds(),
          );
          occStart = base;
          occEnd = new Date(base.getTime() + durationMs);
        }

        const occurrence: RecurringOccurrenceEvent = {
          ...ev,
          id: `${ev.id}::occurrence::${occStart.getTime()}`,
          start: occStart.toISOString(),
          end: occEnd.toISOString(),
          originalEventId: ev.id,
          isOccurrence: true,
        };

        out.push(occurrence);
      }
    } catch (err) {
      console.error('expandRecurringEvents failed for', ev.id, err);
      out.push(ev);
    }
  }

  return out;
}
