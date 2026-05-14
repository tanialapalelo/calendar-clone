'use client';

import { addDays, format, isSameDay, parseISO, startOfWeek } from 'date-fns';
import { layoutOverlappingEvents } from '@/lib/events/overlap-layout';
import { eventsForDay } from '@/lib/events/day';
import {
  DAY_VIEW_COLUMN_GAP_PX,
  DAY_VIEW_GUTTER_PX,
  DAY_VIEW_PX_PER_HOUR,
  DAY_VIEW_PX_PER_MIN,
} from '@/constants';
import { endOfDayExclusive, startOfDayDefaultHour } from '@/lib/date';

function getGmtOffsetLabel(d: Date) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'shortOffset',
  }).formatToParts(d);
  return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
}

/** True if event should only appear in all-day row, not in the timed timeline */
function isAllDayStyle(ev: CalendarEvent): boolean {
  if (ev.allDay) return true;
  const start = new Date(ev.start);
  const end = new Date(ev.end);
  return start.toDateString() !== end.toDateString();
}

export function WeekView(props: {
  date: Date;
  events: CalendarEvent[];
  onOpenEvent: (id: string, rect: DOMRect) => void;
  onCreateEvent: (d: Date) => void;
}) {
  const { date, events, onOpenEvent, onCreateEvent } = props;

  const weekStart = startOfWeek(date, { weekStartsOn: 0 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const today = new Date();
  const tzLabel = getGmtOffsetLabel(today);

  // now indicator
  const nowMinutes = today.getHours() * 60 + today.getMinutes();
  const nowTop = DAY_VIEW_PX_PER_HOUR + nowMinutes * DAY_VIEW_PX_PER_MIN;

  // All-day / multi-day events → top row only
  const allDayEvents = events.filter(isAllDayStyle);

  // Per-day timed events only (exclude all-day to avoid duplicates)
  const positionedByDay = days.map((day) => {
    const dayEvents = eventsForDay(events, day).filter((ev) => !isAllDayStyle(ev));
    return layoutOverlappingEvents(dayEvents, day);
  });

  const hasAllDay = allDayEvents.length > 0;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
      {/* Day headers — scrollable on mobile */}
      <div className="overflow-x-auto">
        <div
          className="grid min-w-[500px] border-b border-gray-200"
          style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px repeat(7, 1fr)` }}
        >
          {/* TZ label cell */}
          <div className="border-r border-gray-200 py-2 pr-2 text-right text-[10px] text-gray-400">
            {tzLabel}
          </div>

          {days.map((day) => {
            const isToday = isSameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className="flex flex-col items-center justify-center border-r border-gray-100 py-2 last:border-r-0"
              >
                <div
                  className={`text-[10px] font-semibold tracking-wide uppercase sm:text-[11px] ${isToday ? 'text-[#0B57D0]' : 'text-gray-500'}`}
                >
                  {/* Short on mobile, full on sm+ */}
                  <span className="sm:hidden">{format(day, 'EEEEE')}</span>
                  <span className="hidden sm:inline">{format(day, 'EEE')}</span>
                </div>
                <div
                  className={
                    isToday
                      ? 'mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#0B57D0] text-sm font-bold text-white sm:h-8 sm:w-8'
                      : 'mt-0.5 flex h-7 w-7 items-center justify-center text-sm font-semibold text-gray-800 sm:h-8 sm:w-8'
                  }
                >
                  {format(day, 'd')}
                </div>
              </div>
            );
          })}
        </div>

        {/* All-day row — only shown when there are all-day events */}
        {hasAllDay && (
          <div
            className="grid min-w-[500px] border-b border-gray-200"
            style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px repeat(7, 1fr)` }}
          >
            <div className="border-r border-gray-200 py-1 pr-2 text-right text-[10px] text-gray-400">
              all-day
            </div>
            {days.map((day) => {
              const dayAllDay = allDayEvents.filter((ev) => {
                const s = new Date(ev.start).getTime();
                const e = new Date(ev.end).getTime();
                const ds = day.getTime();
                const de = addDays(day, 1).getTime();
                return s < de && e > ds;
              });
              return (
                <div
                  key={day.toISOString()}
                  className="min-h-[28px] border-r border-gray-100 px-0.5 py-0.5 last:border-r-0"
                >
                  {dayAllDay.map((ev) => (
                    <div
                      key={ev.id}
                      className="mb-0.5 cursor-pointer truncate rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
                      style={{ background: ev.color ?? '#039BE5' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenEvent(ev.id, e.currentTarget.getBoundingClientRect());
                      }}
                    >
                      {ev.title}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline grid */}
        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 240px)' }}>
          {/* relative wrapper — events overlay + now indicator are absolute children, scroll with grid */}
          <div className="relative" style={{ minWidth: 500 }}>
            {/* Hour rows */}
            <div className="divide-y divide-gray-100">
              {/* Top spacer row */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px repeat(7, 1fr)` }}
              >
                <div
                  className="border-r border-gray-200"
                  style={{ height: DAY_VIEW_PX_PER_HOUR }}
                />
                {days.map((day) => (
                  <div
                    key={day.toISOString()}
                    className="border-r border-gray-100 last:border-r-0"
                    style={{ height: DAY_VIEW_PX_PER_HOUR }}
                  />
                ))}
              </div>

              {hours.map((h) => (
                <div
                  key={h}
                  className="grid"
                  style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px repeat(7, 1fr)` }}
                >
                  <div className="border-r border-gray-200 pt-2 pr-2 text-right text-[10px] text-gray-400">
                    {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
                  </div>
                  {days.map((day) => (
                    <div
                      key={day.toISOString()}
                      className="relative cursor-pointer border-r border-gray-100 last:border-r-0 hover:bg-gray-50"
                      style={{ height: DAY_VIEW_PX_PER_HOUR }}
                      onClick={() => {
                        const d = new Date(day);
                        d.setHours(h, 0, 0, 0);
                        onCreateEvent(d);
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* Events overlay */}
            <div
              className="pointer-events-none absolute inset-0"
              style={{ left: DAY_VIEW_GUTTER_PX }}
            >
              <div
                className="relative grid h-full"
                style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}
              >
                {days.map((day, dayIdx) => {
                  const positioned = positionedByDay[dayIdx];
                  const dayStartMs = startOfDayDefaultHour(day).getTime();
                  const dayEndMs = endOfDayExclusive(day).getTime();

                  return (
                    <div
                      key={day.toISOString()}
                      className="relative border-r border-gray-100 last:border-r-0"
                    >
                      {positioned.map((p) => {
                        const evStart = parseISO(p.event.start).getTime();
                        const evEnd = parseISO(p.event.end).getTime();
                        const continuesFromPrev = evStart < dayStartMs;
                        const continuesToNext = evEnd > dayEndMs;

                        const top = DAY_VIEW_PX_PER_HOUR + p.startMin * DAY_VIEW_PX_PER_MIN;
                        const height = Math.max(18, (p.endMin - p.startMin) * DAY_VIEW_PX_PER_MIN);
                        const leftPct = (p.col / p.colCount) * 100;
                        const widthPct = (1 / p.colCount) * 100;

                        return (
                          <div
                            key={p.event.id}
                            className="pointer-events-auto absolute cursor-pointer"
                            style={{
                              top,
                              height,
                              left: `calc(${leftPct}% + ${DAY_VIEW_COLUMN_GAP_PX / 2}px)`,
                              width: `calc(${widthPct}% - ${DAY_VIEW_COLUMN_GAP_PX}px)`,
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenEvent(p.event.id, e.currentTarget.getBoundingClientRect());
                            }}
                          >
                            <div
                              className={[
                                'h-full overflow-hidden px-1.5 py-0.5 text-[11px] text-white',
                                continuesFromPrev ? 'rounded-t-none rounded-b-md' : 'rounded-t-md',
                                continuesToNext ? 'rounded-b-none' : 'rounded-b-md',
                              ].join(' ')}
                              style={{ background: p.event.color ?? '#039BE5' }}
                            >
                              <div className="truncate font-semibold">{p.event.title}</div>
                              <div className="hidden truncate text-[10px] opacity-90 sm:block">
                                {format(parseISO(p.event.start), 'HH:mm')}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Now indicator */}
            {days.some((d) => isSameDay(d, today)) && (
              <div
                className="pointer-events-none absolute right-0"
                style={{ left: DAY_VIEW_GUTTER_PX, top: nowTop }}
              >
                <div className="relative">
                  <div className="absolute top-1/2 -left-[5px] h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-red-500" />
                  <div className="border-t border-red-500" />
                </div>
              </div>
            )}
          </div>
          {/* end relative inner */}
        </div>
        {/* end overflow-y-auto */}
      </div>
      {/* end overflow-x-auto */}
    </div>
  );
}
