import { generateMonthGrid } from '@/lib/month-grid';
import { format } from 'date-fns';
import { eventsForDay } from '@/lib/events/by-day';

export function MonthView(props: {
  date: Date;
  events: CalendarEvent[];
  onSelectDate?: (d: Date) => void;
}) {
  const { date, events, onSelectDate } = props;
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells = generateMonthGrid(date);
  return (
    <div className="rounded-lg border bg-white p-4">
      {/* Days of week header */}
      <div className="grid grid-cols-7 border-b bg-gray-50">
        {daysOfWeek.map((day) => (
          <div key={day}>
            <span className="px-3 py-2 text-sm font-semibold text-gray-600">{day}</span>
          </div>
        ))}
      </div>

      {/*  Day cell */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const label = format(cell.date, 'd');
          const dayEvents = eventsForDay(events, cell.date);
          const visible = dayEvents.slice(0, 3);
          const remaining = dayEvents.length - visible.length;

          const base =
            'min-h-[96px] border-b border-r p-2 text-sm hover:bg-gray-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-gray-900';
          const muted = cell.inCurrentMonth ? 'text-gray-900' : 'text-gray-400';
          const today = cell.isToday
            ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-white'
            : '';
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              className={`${base} ${muted} text-left`}
              onClick={() => onSelectDate?.(cell.date)}
            >
              <div className="flex items-center justify-between">
                <span className={today}>{label}</span>
              </div>

              <div>
                {visible.map((e) => (
                  <div
                    key={e.id}
                    title={e.title}
                    className="truncate rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-900"
                  >
                    {e.title}
                  </div>
                ))}
                {remaining > 0 && (
                  <div className="mt-1 text-xs text-gray-500">+{remaining} more</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
