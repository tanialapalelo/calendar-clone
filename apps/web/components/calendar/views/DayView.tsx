'use client';

import { format, isSameDay, parseISO } from 'date-fns';
import { layoutOverlappingEvents } from '@/lib/events/overlap-layout';
import { eventsForDay } from '@/lib/events/day';
import { expandRecurringEvents } from '@/lib/events/recurrence';
import {
  DAY_VIEW_COLUMN_GAP_PX,
  DAY_VIEW_GUTTER_PX,
  DAY_VIEW_PX_PER_HOUR,
  DAY_VIEW_PX_PER_MIN,
} from '@/constants';
import { endOfDayExclusive, startOfDayDefaultHour } from '@/lib/date';
import { CircleIcon, Grid2X2Icon } from 'lucide-react';

function getGmtOffsetLabel(d: Date) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'shortOffset',
  }).formatToParts(d);

  const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
  return tz ?? '';
}

export function DayView(props: {
  date: Date;
  events: CalendarEvent[];
  onOpenEvent: (id: string, rect: DOMRect) => void;
}) {
  const { date, events } = props;

  const hours = Array.from({ length: 24 }, (_, i) => i);

  // Expand recurring events for the visible day window so occurrences are included.
  const dayStart = startOfDayDefaultHour(date);
  const dayEnd = endOfDayExclusive(date);
  const expanded = expandRecurringEvents(events, dayStart, dayEnd);

  // events that belong to the day (includes expanded occurrences)
  const dayEvents = eventsForDay(expanded, date);

  // Compute overlapping layout (positions in minutes columns/cols etc.)
  const positioned = layoutOverlappingEvents(dayEvents, date);

  // Now indicator
  const showNowIndicator = isSameDay(date, new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  // Add the top offset that corresponds to the first hour row in the timeline
  const nowTop = DAY_VIEW_PX_PER_HOUR + nowMinutes * DAY_VIEW_PX_PER_MIN;

  const tzLabel = getGmtOffsetLabel(new Date());

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      {/* Header aligned with the grid column */}
      <div className="border-b border-gray-200">
        <div
          className="flex items-center justify-between py-3 pr-4"
          style={{ paddingLeft: DAY_VIEW_GUTTER_PX }}
        >
          <div className="flex items-center gap-3">
            <div className={showNowIndicator ? 'text-[#0B57D0]' : 'text-gray-700'}>
              <div className="text-xs font-semibold tracking-wide uppercase">
                {format(date, 'EEE')}
              </div>
              <div
                className={
                  showNowIndicator
                    ? 'mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0B57D0] text-xl font-semibold text-white'
                    : 'mt-1 text-2xl font-semibold text-gray-900'
                }
              >
                {format(date, 'd')}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative">
        <div className="divide-y divide-gray-200">
          <div className="grid" style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px 1fr` }}>
            <div className="border-r border-gray-200 pt-2 pr-2 text-right text-[11px] text-gray-500">
              <div className="text-xs text-gray-500">{tzLabel}</div>
            </div>

            {/* first hour row (top offset) */}
            <div style={{ height: DAY_VIEW_PX_PER_HOUR }}>
              <div className="absolute top-1/2 right-0 left-0 border-t border-gray-100" />
            </div>
          </div>

          {hours.map((h) => (
            <div
              key={h}
              className="grid"
              style={{ gridTemplateColumns: `${DAY_VIEW_GUTTER_PX}px 1fr` }}
            >
              <div className="border-r border-gray-200 pt-2 pr-2 text-right text-[11px] text-gray-500">
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>

              <div className="relative" style={{ height: DAY_VIEW_PX_PER_HOUR }}>
                <div className="absolute top-1/2 right-0 left-0 border-t border-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Events overlay (absolute positioned, aligned with the grid above) */}
        <div className="absolute inset-0" style={{ left: DAY_VIEW_GUTTER_PX }}>
          <div className="relative h-full">
            {positioned.map((p) => {
              const allDay = !!p.event.allDay;
              const crossDay = !isSameDay(parseISO(p.event.start), parseISO(p.event.end));

              const dayStartMs = startOfDayDefaultHour(date).getTime();
              const dayEndMs = endOfDayExclusive(date).getTime();

              const evStart = parseISO(p.event.start).getTime();
              const evEnd = parseISO(p.event.end).getTime();

              const continuesFromPrev = evStart < dayStartMs;
              const continuesToNext = evEnd > dayEndMs;

              // position within timeline: minutes since midnight
              const startMin = p.startMin;
              const endMin = p.endMin;

              // top needs to include the initial hour-row offset used above
              const top =
                allDay || crossDay ? 0 : DAY_VIEW_PX_PER_HOUR + startMin * DAY_VIEW_PX_PER_MIN;
              const height =
                allDay || crossDay
                  ? DAY_VIEW_PX_PER_HOUR / 2
                  : Math.max(18, (endMin - startMin) * DAY_VIEW_PX_PER_MIN);

              const leftPct = (p.col / p.colCount) * 100;
              const widthPct = (1 / p.colCount) * 100;

              // Prefer originalEventId when opening occurrence so parent can find the series
              const openId = (p.event as any).originalEventId ?? p.event.id;

              // optional icons for tasks/appointments if you want to surface them
              const isNotEvent = p.event.isTask ? (
                <CircleIcon size={8} />
              ) : p.event.isAppointment ? (
                <Grid2X2Icon size={8} />
              ) : null;

              return (
                <div
                  key={p.event.id}
                  className="absolute"
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + ${DAY_VIEW_COLUMN_GAP_PX / 2}px)`,
                    width: `calc(${widthPct}% - ${DAY_VIEW_COLUMN_GAP_PX}px)`,
                  }}
                  title={`${p.event.title} (${format(parseISO(p.event.start), 'MMM d HH:mm')}–${format(
                    parseISO(p.event.end),
                    'MMM d HH:mm',
                  )})`}
                  onClick={(e) => {
                    const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                    props.onOpenEvent(openId, rect);
                  }}
                >
                  <div
                    className={[
                      'relative h-full overflow-hidden px-2 py-1 text-xs text-white',
                      continuesFromPrev ? 'rounded-l-full' : 'rounded-md',
                      continuesToNext ? 'rounded-r-full' : 'rounded-md',
                    ].join(' ')}
                    style={{ background: p.event.color ?? '#039BE5' }}
                  >
                    <div className="truncate font-semibold">{p.event.title}</div>
                    {!allDay && !crossDay && (
                      <div className="truncate text-[11px]">
                        {format(parseISO(p.event.start), 'HH:mm')} –{' '}
                        {format(parseISO(p.event.end), 'HH:mm')}
                      </div>
                    )}
                    {allDay && (
                      <div className="text-[11px] opacity-90">
                        {/* optionally show 'All day' */}
                      </div>
                    )}
                    <div className="absolute top-1 right-1">{isNotEvent}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Now indicator (aligned with the same top-offset used for events) */}
        {showNowIndicator && (
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
    </div>
  );
}

export default DayView;
