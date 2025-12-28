import { format, parseISO } from 'date-fns';
import { eventsForDayLayout, minutesSinceStartOfDay, clamp } from '@/lib/events/day-layout';

export function DayView(props: { date: Date; events: CalendarEvent[] }) {
  const { date, events } = props;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const dayEvents = eventsForDayLayout(events, date);

  // Visual constants:
  // 1 hour = 48px tall (you can tweak this later)
  const PX_PER_HOUR = 48;
  const PX_PER_MIN = PX_PER_HOUR / 60;

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Day</h2>
        <p className="mt-1 text-sm text-gray-600">{format(date, 'EEE, MMM d, yyyy')}</p>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Grid rows */}
        <div className="divide-y">
          {hours.map((hour) => {
            const label =
              hour === 0
                ? '12 AM'
                : hour < 12
                  ? `${hour} AM`
                  : hour === 12
                    ? '12 PM'
                    : `${hour - 12} PM`;
            return (
              <div key={hour} className="grid grid-cols-[80px_1fr]">
                <div className="border-r px-3 py-3 text-xs text-gray-500">{label}</div>
                <div className="px-3 py-3" style={{ height: PX_PER_HOUR }}>
                  {/* Placeholder for events */}
                  <div className="h-6 rounded bg-gray-50"></div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Event overlay layer */}
        <div className="pointer-events-none absolute inset-y-0 right-0 left-[80px]">
          <div className="h-full">
            {dayEvents.map((e) => {
              const startMin = clamp(minutesSinceStartOfDay(e.start, date), 0, 24 * 60);
              const endMin = clamp(minutesSinceStartOfDay(e.end, date), 0, 24 * 60);

              const top = startMin * PX_PER_MIN;
              const height = Math.max(18, (endMin - startMin) * PX_PER_MIN);

              return (
                <div
                  key={e.id}
                  className="absolute right-3 left-3 rounded bg-blue-600/90 px-2 py-1 text-xs font-semibold text-white shadow"
                  style={{ top, height }}
                  title={`${e.title} (${format(parseISO(e.start), 'HH:mm')}–${format(parseISO(e.end), 'HH:mm')})`}
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
