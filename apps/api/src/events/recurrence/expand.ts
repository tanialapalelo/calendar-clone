import { addDays } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import type { EventInstance, EventRow, ExceptionRow } from '../event-select';
import {
  dateOnlyFromInstantInTz,
  ensureEndAfterStartDateExclusive,
  localMidnightNaiveFromUtcInstant,
  naiveFromDateColumn,
  toLocalNaiveInTz,
} from './date-utils';
import { buildFloatingRule, generateAfterExclusive } from './rule';
import { applyExceptionToInstance } from './exceptions';
import { exceptionKey, makeInstanceId } from './instance-id';

/** Hard cap on materialized occurrences per master event in a window — DoS guardrail. */
export const MAX_OCCURRENCES = 2000;

/** Turn a non-recurring DB row into an EventInstance (handles all-day normalization). */
export function masterToInstance(ev: EventRow): EventInstance {
  if (ev.allDay && ev.startDate && ev.endDate) {
    const tz = ev.recurrenceTimeZone ?? ev.timeZone ?? 'UTC';
    const startAt = fromZonedTime(naiveFromDateColumn(ev.startDate), tz);
    const endAt = fromZonedTime(naiveFromDateColumn(ev.endDate), tz);
    return {
      ...ev,
      allDay: true,
      startAt,
      endAt,
      recurrenceRule: null,
      recurringEventId: null,
      originalStartAt: null,
      isRecurringInstance: false,
    };
  }
  return {
    ...ev,
    recurringEventId: null,
    originalStartAt: null,
    isRecurringInstance: false,
  };
}

/**
 * Expand a recurring master into individual occurrences inside [from, to),
 * applying matching exceptions. Falls back to returning the master if rrule parsing fails.
 */
export function expandRecurringMaster(
  ev: EventRow,
  from: Date,
  to: Date,
  exceptionMap: Map<string, ExceptionRow>,
): EventInstance[] {
  const tz = ev.recurrenceTimeZone ?? ev.timeZone ?? 'UTC';
  const ruleOnly = ev.recurrenceRule!;
  const durationMs = ev.endAt.getTime() - ev.startAt.getTime();
  const out: EventInstance[] = [];

  try {
    if (ev.allDay) {
      // ── all-day: date-only is the source of truth, rule iterated as floating local
      const startDateCol =
        ev.startDate ?? dateOnlyFromInstantInTz(ev.startAt, tz);
      const endDateCol = ensureEndAfterStartDateExclusive(
        startDateCol,
        ev.endDate ?? dateOnlyFromInstantInTz(ev.endAt, tz),
      );

      const masterStartNaive = naiveFromDateColumn(startDateCol);
      const masterEndNaiveExclusive = naiveFromDateColumn(endDateCol);
      const masterDurationDays = Math.max(
        1,
        Math.round(
          (masterEndNaiveExclusive.getTime() - masterStartNaive.getTime()) /
            86_400_000,
        ),
      );

      const rule = buildFloatingRule(ruleOnly, masterStartNaive);
      const fromNaive = localMidnightNaiveFromUtcInstant(from, tz);
      const toNaive = localMidnightNaiveFromUtcInstant(to, tz);

      const occNaive = generateAfterExclusive({
        rule,
        fromNaive,
        toNaive,
        max: MAX_OCCURRENCES,
      });

      for (const occStartNaive of occNaive) {
        const occEndNaiveExclusive = addDays(occStartNaive, masterDurationDays);
        const occStartUtc = fromZonedTime(occStartNaive, tz);
        const occEndUtc = fromZonedTime(occEndNaiveExclusive, tz);
        if (occEndUtc <= from || occStartUtc >= to) continue;

        const occStartDateCol = dateOnlyFromInstantInTz(occStartUtc, tz);
        const occEndDateCol = addDays(occStartDateCol, masterDurationDays);
        const originalStartAt = occStartUtc.toISOString();

        const instance: EventInstance = {
          ...ev,
          id: makeInstanceId(ev.id, originalStartAt),
          allDay: true,
          startAt: occStartUtc,
          endAt: occEndUtc,
          startDate: occStartDateCol,
          endDate: occEndDateCol,
          recurringEventId: ev.id,
          originalStartAt,
          isRecurringInstance: true,
        };

        const ex = exceptionMap.get(exceptionKey(ev.id, originalStartAt));
        const applied = ex
          ? applyExceptionToInstance(instance, ex, tz)
          : instance;
        if (applied) out.push(applied);
      }
    } else {
      // ── timed: iterate the rule in event-local time so weekdays don't drift in UTC
      const masterStartNaive = toLocalNaiveInTz(ev.startAt, tz);
      const rule = buildFloatingRule(ruleOnly, masterStartNaive);
      const fromNaive = toLocalNaiveInTz(from, tz);
      const toNaive = toLocalNaiveInTz(to, tz);

      const occNaive = generateAfterExclusive({
        rule,
        fromNaive,
        toNaive,
        max: MAX_OCCURRENCES,
      });

      for (const occStartNaive of occNaive) {
        const occStartUtc = fromZonedTime(occStartNaive, tz);
        const occEndUtc = new Date(occStartUtc.getTime() + durationMs);
        if (occEndUtc <= from || occStartUtc >= to) continue;

        const originalStartAt = occStartUtc.toISOString();

        const instance: EventInstance = {
          ...ev,
          id: makeInstanceId(ev.id, originalStartAt),
          allDay: false,
          startAt: occStartUtc,
          endAt: occEndUtc,
          startDate: null,
          endDate: null,
          recurringEventId: ev.id,
          originalStartAt,
          isRecurringInstance: true,
        };

        const ex = exceptionMap.get(exceptionKey(ev.id, originalStartAt));
        const applied = ex
          ? applyExceptionToInstance(instance, ex, tz)
          : instance;
        if (applied) out.push(applied);
      }
    }
  } catch {
    // Fallback: return master unexpanded so the UI doesn't lose the event
    out.push(masterToInstance(ev));
  }

  return out;
}
