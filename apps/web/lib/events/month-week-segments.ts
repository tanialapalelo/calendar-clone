import { addDays, parseISO, startOfDay, subMilliseconds } from 'date-fns';
import { isBarEventInMonth } from './month-classify';

export type WeekBarSegment = {
  event: CalendarEvent;
  startCol: number; // 0..6
  endColExclusive: number; // 1..7
  lane: number;
  continuesFromPrevWeek: boolean;
  continuesToNextWeek: boolean;
};

function intersectsRange(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aEnd > bStart && aStart < bEnd;
}

/**
 * Build and pack bar segments for a single week.
 * - weekDates: array of 7 Date objects (Sun..Sat) produced by generateMonthGrid slice
 * - events: all calendar events (function will filter to bar events that intersect the week)
 *
 * Returns: { segments, laneCount }
 */
export function buildWeekBarLayout(weekDates: Date[], events: CalendarEvent[]) {
  const weekStart = startOfDay(weekDates[0]).getTime();
  const weekEnd = startOfDay(addDays(weekDates[6], 1)).getTime(); // exclusive

  const candidates = events.filter(isBarEventInMonth);

  const base = candidates
    .map((ev) => {
      const evStart = parseISO(ev.start).getTime();
      const evEnd = parseISO(ev.end).getTime();

      if (!intersectsRange(evStart, evEnd, weekStart, weekEnd)) return null;

      const segStart = Math.max(evStart, weekStart);
      const segEnd = Math.min(evEnd, weekEnd);

      const startCol = Math.max(0, Math.min(6, Math.floor((segStart - weekStart) / 86400000)));
      const endColExclusive = Math.max(1, Math.min(7, Math.ceil((segEnd - weekStart) / 86400000)));

      const evEndInclusive = subMilliseconds(parseISO(ev.end), 1).getTime();

      return {
        event: ev,
        startCol,
        endColExclusive,
        continuesFromPrevWeek: evStart < weekStart,
        continuesToNextWeek: evEndInclusive >= weekEnd,
      } as Omit<WeekBarSegment, 'lane'>;
    })
    .filter(Boolean) as Omit<WeekBarSegment, 'lane'>[];

  // Greedy lane packing (horizontal): place each segment in first free lane
  const lanes: { endColExclusive: number }[] = [];
  const packed: WeekBarSegment[] = [];

  for (const seg of base.sort(
    (a, b) => a.startCol - b.startCol || a.endColExclusive - b.endColExclusive,
  )) {
    let lane = 0;
    for (; lane < lanes.length; lane++) {
      if (seg.startCol >= lanes[lane].endColExclusive) break;
    }
    if (!lanes[lane]) lanes[lane] = { endColExclusive: seg.endColExclusive };
    else lanes[lane].endColExclusive = seg.endColExclusive;

    packed.push({
      ...seg,
      lane,
    } as WeekBarSegment);
  }

  return { segments: packed, laneCount: lanes.length };
}
