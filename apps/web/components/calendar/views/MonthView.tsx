import { generateMonthGrid } from '@/lib/month-grid';
import { format } from 'date-fns';
import { eventsForDay } from '@/lib/events/day';
import { daysOfWeek } from '@/constants';

export function MonthView(props: {
  date: Date;
  events: CalendarEvent[];
  onSelectDate?: (d: Date) => void;
  onCreate: (d: Date) => void;
  onOpenEvent: (id: string, rect: DOMRect) => void;
  onOpenDayPopover: (d: Date, rect: DOMRect) => void;
}) {
  const { date, events, onSelectDate, onCreate, onOpenEvent, onOpenDayPopover } = props;
  const cells = generateMonthGrid(date);
  // group 42 cells into 6 weeks
  const weeks = Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) =>
    cells.slice(w * 7, w * 7 + 7),
  );

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
            ? 'inline-flex items-center justify-center rounded-full bg-[#0B57D0] text-white'
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
                  className={`${today} h-7 w-7`}
                  onClick={(e) => {
                    e.stopPropagation(); // CRITICAL: prevents triggering onCreate
                    onSelectDate?.(cell.date);
                  }}
                >
                  {label}
                </button>
              </div>

              <div className="text-left">
                {visible.map((ev) => (
                  <div
                    key={ev.id}
                    title={ev.title}
                    className="mt-1 cursor-pointer truncate rounded bg-[#039BE5] px-2 py-0.5 text-xs font-medium text-white hover:bg-[#0090d6]"
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      e.stopPropagation();
                      onOpenEvent(ev.id, rect);
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
                {remaining > 0 && (
                  <div
                    className="mt-1 rounded px-2 py-0.5 text-xs font-semibold text-gray-900 hover:bg-gray-200"
                    onClick={(clickEvt) => {
                      clickEvt.stopPropagation(); // CRITICAL: prevents triggering onCreate
                      const rect = clickEvt.currentTarget.getBoundingClientRect();
                      onOpenDayPopover?.(cell.date, rect);
                    }}
                  >
                    {remaining} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
