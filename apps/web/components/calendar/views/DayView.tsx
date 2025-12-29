import { format, parseISO } from 'date-fns';
import { eventMinutesWithinDay, eventsForDayLayout } from '../../../lib/events/day-layout';

export function DayView(props: { date: Date; events: CalendarEvent[] }) {
  const { date, events } = props;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = eventsForDayLayout(events, date);

  const PX_PER_HOUR = 48;
  const PX_PER_MIN = PX_PER_HOUR / 60;

  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Day</h2>
        <p className="mt-1 text-sm text-gray-600">{format(date, 'EEE, MMM d, yyyy')}</p>
      </div>

      <div className="relative">
        <div className="divide-y">
          {hours.map((h) => (
            <div key={h} className="grid grid-cols-[80px_1fr]">
              <div className="border-r px-3 py-3 text-xs text-gray-500">
                {`${String(h).padStart(2, '0')}:00`}
              </div>
              <div className="px-3 py-3" style={{ height: PX_PER_HOUR }} />
            </div>
          ))}
        </div>

        <div className="pointer-events-none absolute inset-0 left-[80px]">
          <div className="h-full">
            {dayEvents.map((e) => {
              const { startMin, endMin } = eventMinutesWithinDay(e, date);

              const top = startMin * PX_PER_MIN;
              const height = Math.max(18, (endMin - startMin) * PX_PER_MIN);

              return (
                <div
                  key={e.id}
                  className="absolute right-3 left-3 rounded bg-blue-600/90 px-2 py-1 text-xs font-semibold text-white shadow"
                  style={{ top, height }}
                  title={`${e.title} (${format(parseISO(e.start), 'MMM d HH:mm')}–${format(
                    parseISO(e.end),
                    'MMM d HH:mm',
                  )})`}
                >
                  <div className="truncate">{e.title}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
