import { generateMonthGrid } from '@/lib/month-grid';
import { format, parseISO } from 'date-fns';
import { eventsForDay } from '@/lib/events/day';
import { daysOfWeek } from '@/constants';
import { buildWeekBarLayout } from '@/lib/events/month-week-segments';
import { isBarEventInMonth } from '@/lib/events/month-classify';

export function MonthView(props: {
  date: Date;
  events: CalendarEvent[];
  onSelectDate?: (d: Date) => void;
  onCreate: (d: Date) => void;
  onOpenEvent: (id: string, rect: DOMRect) => void;
  onOpenDayPopover?: (d: Date, rect: DOMRect) => void;
}) {
  const { date, events, onSelectDate, onCreate, onOpenEvent, onOpenDayPopover } = props;
  const cells = generateMonthGrid(date);
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  );
  const ROW_HEIGHT = 18;
  const ROW_GAP = 4;
  const BAR_ROWS = 2; // fixed number of bar lanes to reserve per week (tweak as desired)
  const TOTAL_ROWS = 4; // total vertical rows per day (bars + timed)
  const OVERLAY_TOP = 44; // same as before

  return (
    <div className="rounded-3xl bg-white p-4">
      {/* Days of week header */}
      <div className="grid w-full grid-cols-7 text-center">
        {daysOfWeek.map((day) => (
          <div key={day}>
            <span className="px-3 py-2 text-sm font-semibold text-gray-600">{day}</span>
          </div>
        ))}
      </div>

      {/* Weeks */}
      <div className="grid grid-cols-1">
        {weeks.map((weekCells, weekIdx) => {
          const weekDates = weekCells.map((c) => c.date);
          const { segments, laneCount } = buildWeekBarLayout(weekDates, events);

          // show up to BAR_ROWS lanes (fixed)
          const lanesShown = Math.min(laneCount, BAR_ROWS);

          // timed rows per day (available fixed budget)
          const timedRowsPerDay = Math.max(0, TOTAL_ROWS - lanesShown);

          // Reserve exactly BAR_ROWS worth of height for the overlay
          const reservedOverlayHeight = BAR_ROWS * ROW_HEIGHT + Math.max(0, BAR_ROWS) * ROW_GAP;

          return (
            <div key={weekIdx} className="relative">
              {/* Day cells */}
              <div className="grid grid-cols-7">
                {weekCells.map((cell, colIdx) => {
                  const label = format(cell.date, 'd');
                  const todayClass = cell.isToday
                    ? 'inline-flex items-center justify-center rounded-full bg-[#0B57D0] text-white'
                    : '';

                  const dayAll = eventsForDay(events, cell.date);

                  // timed single-day events only (exclude bar events)
                  const timed = dayAll
                    .filter((ev) => !isBarEventInMonth(ev))
                    .sort((a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime());

                  const visibleTimed = timed.slice(0, timedRowsPerDay);
                  const hiddenTimed = Math.max(0, timed.length - visibleTimed.length);

                  const hiddenBars = segments.filter(
                    (s) =>
                      s.lane >= lanesShown && colIdx >= s.startCol && colIdx < s.endColExclusive,
                  ).length;

                  const hiddenTotal = hiddenBars + hiddenTimed;

                  return (
                    <div
                      key={cell.date.toISOString()}
                      role="button"
                      className="flex min-h-[120px] cursor-pointer flex-col border-r border-b border-[#E1E3E1] p-2 text-sm hover:bg-gray-50"
                      onClick={() => onCreate(cell.date)}
                    >
                      <div className="flex items-center justify-center">
                        <button
                          className={`${todayClass} h-7 w-7`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectDate?.(cell.date);
                          }}
                        >
                          {label}
                        </button>
                      </div>

                      {/* Reserve vertical space for bars overlay if only there's bars */}
                      <div style={{ height: reservedOverlayHeight }} />

                      {/* Timed single-day list */}
                      <div className="relative mt-1 space-y-1 text-left">
                        {visibleTimed.map((ev) => (
                          <div
                            key={ev.id}
                            className="flex cursor-pointer items-center gap-2 truncate rounded px-1 text-[11px] text-gray-800 hover:bg-gray-200"
                            title={ev.title}
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              onOpenEvent(ev.id, rect);
                            }}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                            <span className="shrink-0 text-gray-600">
                              {format(parseISO(ev.start), 'h:mma').toLowerCase()}
                            </span>
                            <span className="truncate">{ev.title}</span>
                          </div>
                        ))}

                        {hiddenTotal > 0 && (
                          // Render the "+N more" as an interactive control with hover style and open popover behavior
                          <button
                            type="button"
                            className="relative mt-1 w-full rounded px-1 py-0.5 text-left text-xs font-semibold text-gray-900 hover:bg-gray-200"
                            onClick={(clickEvt) => {
                              clickEvt.stopPropagation();
                              if (onOpenDayPopover) {
                                const rect = (
                                  clickEvt.currentTarget as HTMLButtonElement
                                ).getBoundingClientRect();
                                onOpenDayPopover(cell.date, rect);
                              }
                            }}
                          >
                            {hiddenTotal} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Bars overlay (week-level) */}
              <div className="absolute inset-x-0 px-1" style={{ top: OVERLAY_TOP }}>
                <div
                  className="grid grid-cols-7"
                  style={{ gridAutoRows: `${ROW_HEIGHT}px`, rowGap: `${ROW_GAP}px` }}
                >
                  {segments
                    .filter((s) => s.lane < lanesShown)
                    .map((s) => {
                      const roundedLeft = !s.continuesFromPrevWeek;
                      const roundedRight = !s.continuesToNextWeek;

                      const leftCapClass = roundedLeft ? 'rounded-l-full' : 'rounded-l-none';
                      const rightCapClass = roundedRight ? 'rounded-r-full' : 'rounded-r-none';

                      return (
                        <div
                          key={`${s.event.id}-${weekIdx}-${s.startCol}-${s.lane}`}
                          className={`pointer-events-auto relative flex items-center truncate bg-[#039BE5] px-2 text-[11px] font-medium text-white hover:bg-[#0090d6] ${leftCapClass} ${rightCapClass}`}
                          style={{
                            gridColumn: `${s.startCol + 1} / ${s.endColExclusive + 1}`,
                            gridRow: `${s.lane + 1}`,
                          }}
                          title={s.event.title}
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = (
                              e.currentTarget as HTMLDivElement
                            ).getBoundingClientRect();
                            onOpenEvent(s.event.id, rect);
                          }}
                        >
                          <span className="truncate">{s.event.title}</span>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
