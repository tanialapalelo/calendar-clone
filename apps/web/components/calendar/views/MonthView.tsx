import { generateMonthGrid } from '@/lib/month-grid';
import { format } from 'date-fns';
import { eventsForDay } from '@/lib/events/by-day';

export function MonthView(props: {
  date: Date;
  events: CalendarEvent[];
  onSelectDate?: (d: Date) => void;
  onCreate: (d: Date) => void;
}) {
  const { date, events, onSelectDate, onCreate } = props;
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const cells = generateMonthGrid(date);
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

      {/*  Day cell */}
      <div className="grid grid-cols-7">
        {cells.map((cell) => {
          const label = format(cell.date, 'd');
          const dayEvents = eventsForDay(events, cell.date);
          const visible = dayEvents.slice(0, 3);
          const remaining = dayEvents.length - visible.length;

          const base =
            'min-h-[96px] border-b border-r border-[#E1E3E1] p-2 text-sm hover:bg-gray-50 cursor-pointer flex flex-col';
          const today = cell.isToday
            ? 'inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#0B57D0] text-white'
            : '';
          return (
            <div
              key={cell.date.toISOString()}
              role="button"
              className={`${base}`}
              onClick={() => onCreate(cell.date)}
            >
              <div className="flex items-center justify-center">
                <button
                  className={today}
                  onClick={(e) => {
                    e.stopPropagation(); // CRITICAL: prevents triggering onCreate
                    onSelectDate?.(cell.date);
                  }}
                >
                  {label}
                </button>
              </div>

              <div className="text-left">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
