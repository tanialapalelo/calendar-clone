'use strict';

import { RRule } from 'rrule';
import { parseISO, addDays } from 'date-fns';

/**
 * Expand recurring events into concrete instances within the given [windowStart, windowEnd).
 *
 * - For non-recurring events: included unchanged.
 * - For recurring events:
 *   - parse stored start/end with parseISO (local-aware)
 *   - anchor RRule.dtstart to the original local Y/M/D/H/M/S
 *   - if ev.allDay === true: anchor dtstart to local midnight and generate occurrences as [midnight, next midnight)
 *   - create instance objects:
 *       id: `${parentId}::occurrence::${occStart.getTime()}`
 *       start/end: ISO strings (occurrence start/end)
 *       originalEventId: parent id
 *       isOccurrence: true
 *       allDay: copied from parent
 */
export function expandRecurringEvents(
  events: Record<string, any>[],
  windowStart: Date,
  windowEnd: Date,
) {
  const out: Record<string, any>[] = [];

  for (const ev of events) {
    if (!ev?.recurrence) {
      out.push(ev);
      continue;
    }

    try {
      // Parse stored ISO start/end into Date objects (local)
      const origStart = parseISO(ev.start);
      const origEnd = parseISO(ev.end);
      const durationMs = origEnd.getTime() - origStart.getTime();

      // Parse RRULE options and anchor dtstart to the event's local components.
      // For all-day events we anchor at local midnight of origStart.
      const opts = RRule.parseString(ev.recurrence);

      if (ev.allDay) {
        // Anchor at local midnight
        opts.dtstart = new Date(
          origStart.getFullYear(),
          origStart.getMonth(),
          origStart.getDate(),
          0,
          0,
          0,
          0,
        );
      } else {
        // Anchor at the exact local time-of-day
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

      // Find occurrences in the requested window (inclusive start)
      const occDates = rule.between(windowStart, windowEnd, true);

      for (const occ of occDates) {
        let occStart: Date;
        let occEnd: Date;

        if (ev.allDay) {
          // For all-day: set occurrence start at local midnight of occ date,
          // and end at next local midnight (i.e., +1 day).
          occStart = new Date(occ.getFullYear(), occ.getMonth(), occ.getDate(), 0, 0, 0, 0);
          occEnd = addDays(occStart, 1); // exclusive end
        } else {
          // For timed events: preserve the original duration and local time offset
          occStart = new Date(
            occ.getFullYear(),
            occ.getMonth(),
            occ.getDate(),
            occ.getHours(),
            occ.getMinutes(),
            occ.getSeconds(),
            occ.getMilliseconds(),
          );
          occEnd = new Date(occStart.getTime() + durationMs);
        }

        out.push({
          ...ev,
          id: `${ev.id}::occurrence::${occStart.getTime()}`,
          start: occStart.toISOString(),
          end: occEnd.toISOString(),
          originalEventId: ev.id,
          isOccurrence: true,
          allDay: !!ev.allDay,
        });
      }
    } catch (err) {
      // On error, include original event so nothing disappears
      console.error('expandRecurringEvents failed for', ev?.id, err);
      out.push(ev);
    }
  }

  return out;
}
