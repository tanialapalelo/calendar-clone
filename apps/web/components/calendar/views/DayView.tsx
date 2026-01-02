import { format, isSameDay, parseISO } from 'date-fns';
import { eventsForDayLayout } from '@/lib/events/day-layout';
import { layoutOverlappingEvents } from '@/lib/events/overlap-layout';

function getGmtOffsetLabel(d: Date) {
  const parts = new Intl.DateTimeFormat(undefined, {
    timeZoneName: 'shortOffset',
  }).formatToParts(d);

  const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
  return tz ?? '';
}

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDayExclusive(d: Date) {
  const x = startOfDay(d);
  x.setDate(x.getDate() + 1);
  return x;
}

export function DayView(props: {
  date: Date;
  events: CalendarEvent[];
  onOpenEvent: (id: string, rect: DOMRect) => void;
}) {
  const { date, events } = props;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = eventsForDayLayout(events, date);
  const positioned = layoutOverlappingEvents(dayEvents, date);

  const PX_PER_HOUR = 48;
  const PX_PER_MIN = PX_PER_HOUR / 60;
  const GUTTER_PX = 64;

  const showNowIndicator = isSameDay(date, new Date());
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nowTop = nowMinutes * PX_PER_MIN;

  const tzLabel = getGmtOffsetLabel(new Date());

  return (
    <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white">
      {/* Header aligned with the grid column */}
      <div className="border-b border-gray-200">
        <div
          className="flex items-center justify-between py-3 pr-4"
          style={{ paddingLeft: GUTTER_PX }}
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
          <div className="grid" style={{ gridTemplateColumns: `${GUTTER_PX}px 1fr` }}>
            <div className="border-r border-gray-200 pt-2 pr-2 text-right text-[11px] text-gray-500">
              <div className="text-xs text-gray-500">{tzLabel}</div>
            </div>

            <div className="" style={{ height: PX_PER_HOUR }}>
              <div className="absolute top-1/2 right-0 left-0 border-t border-gray-100" />
            </div>
          </div>
          {hours.map((h) => (
            <div key={h} className="grid" style={{ gridTemplateColumns: `${GUTTER_PX}px 1fr` }}>
              <div className="border-r border-gray-200 pt-2 pr-2 text-right text-[11px] text-gray-500">
                {h === 0 ? '' : `${String(h).padStart(2, '0')}:00`}
              </div>

              <div className="relative" style={{ height: PX_PER_HOUR }}>
                <div className="absolute top-1/2 right-0 left-0 border-t border-gray-100" />
              </div>
            </div>
          ))}
        </div>

        {/* Events overlay */}
        <div className="absolute inset-0" style={{ left: GUTTER_PX }}>
          <div className="relative h-full">
            {positioned.map((p, i) => {
              const allDay = p.event.allDay;
              const crossDay = !isSameDay(parseISO(p.event.start), parseISO(p.event.end));
              const dayStart = startOfDay(date).getTime();
              const dayEnd = endOfDayExclusive(date).getTime();

              const evStart = parseISO(p.event.start).getTime();
              const evEnd = parseISO(p.event.end).getTime();

              const continuesFromPrev = evStart < dayStart;
              const continuesToNext = evEnd > dayEnd;

              const top = allDay || crossDay ? 0 : p.startMin * PX_PER_MIN + PX_PER_HOUR;
              const height =
                allDay || crossDay
                  ? PX_PER_HOUR / 2
                  : Math.max(18, (p.endMin - p.startMin) * PX_PER_MIN);

              const GAP_PX = 6; // space between columns (Google-ish)
              const leftPct = (p.col / p.colCount) * 100;
              const widthPct = (1 / p.colCount) * 100;

              return (
                <div
                  key={p.event.id}
                  className="absolute"
                  style={{
                    top,
                    height,
                    left: `calc(${leftPct}% + ${GAP_PX / 2}px)`,
                    width: `calc(${widthPct}% - ${GAP_PX}px)`,
                  }}
                  title={`${p.event.title} (${format(parseISO(p.event.start), 'MMM d HH:mm')}–${format(
                    parseISO(p.event.end),
                    'MMM d HH:mm',
                  )})`}
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    props.onOpenEvent(p.event.id, rect);
                  }}
                >
                  {/* Main body */}
                  <div
                    className={[
                      'relative h-full overflow-hidden border border-blue-200 bg-blue-50 px-2 py-1 text-xs text-blue-900',
                      continuesFromPrev ? 'rounded-l-full' : 'rounded-md',
                      continuesToNext ? 'rounded-r-full' : 'rounded-md',
                    ].join(' ')}
                  >
                    <div className="truncate font-semibold">{p.event.title}</div>
                    {!allDay && !crossDay && (
                      <div className="truncate text-[11px] text-blue-800/80">
                        {format(parseISO(p.event.start), 'HH:mm')} –{' '}
                        {format(parseISO(p.event.end), 'HH:mm')}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Now indicator */}
        {showNowIndicator && (
          <div
            className="pointer-events-none absolute right-0"
            style={{ left: GUTTER_PX, top: nowTop }}
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
