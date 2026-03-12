'use client';

import { format, addMonths, isSameMonth, isSameDay, startOfMonth } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon, PlusIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { generateMonthGrid } from '@/lib/month-grid';
import { shortDaysOfWeek } from '@/constants';
import { apiFetch } from '@/lib/api/client';

type ApiCalendar = {
  id: string;
  name: string;
  color: string | null;
};

/** Compact mini-calendar that lets you pick a date */
function MiniCalendar(props: {
  currentDate: Date;
  selectedDate: Date;
  onPickDate: (d: Date) => void;
}) {
  const { currentDate, selectedDate, onPickDate } = props;
  const [monthDate, setMonthDate] = useState(() => startOfMonth(currentDate));

  // Keep month in sync when parent date changes month
  useEffect(() => {
    if (!isSameMonth(monthDate, currentDate)) {
      setMonthDate(startOfMonth(currentDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const cells = generateMonthGrid(monthDate);

  return (
    <div className="px-2 py-2">
      {/* Month nav */}
      <div className="flex items-center justify-between px-1 pb-1">
        <span className="text-xs font-semibold text-gray-700">{format(monthDate, 'MMM yyyy')}</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-gray-100"
            onClick={() => setMonthDate((d) => addMonths(d, -1))}
            aria-label="Previous month"
          >
            <ChevronLeftIcon size={14} />
          </button>
          <button
            type="button"
            className="rounded-full p-0.5 hover:bg-gray-100"
            onClick={() => setMonthDate((d) => addMonths(d, 1))}
            aria-label="Next month"
          >
            <ChevronRightIcon size={14} />
          </button>
        </div>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 text-center">
        {shortDaysOfWeek.map((d, i) => (
          <div key={`${d}-${i}`} className="py-0.5 text-[10px] font-semibold text-gray-400">
            {d}
          </div>
        ))}

        {/* Day cells */}
        {cells.map((cell) => {
          const isCurrentMonth = isSameMonth(cell.date, monthDate);
          // Only highlight today if the cell belongs to the displayed month
          const isToday = cell.isToday && isCurrentMonth;
          const isSelected = isSameDay(cell.date, selectedDate) && isCurrentMonth;

          let cls =
            'mx-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-full text-[11px] transition-colors';

          if (isToday && isSelected) {
            cls += ' bg-[#0B57D0] font-bold text-white';
          } else if (isToday) {
            cls += ' bg-[#0B57D0] font-bold text-white';
          } else if (isSelected) {
            cls += ' bg-[#C2E7FF] font-semibold text-gray-900';
          } else if (!isCurrentMonth) {
            cls += ' text-gray-300 hover:bg-gray-50';
          } else {
            cls += ' text-gray-700 hover:bg-gray-100';
          }

          return (
            <div key={cell.date.toISOString()} className="flex justify-center py-0.5">
              <div
                className={cls}
                role="button"
                tabIndex={0}
                onClick={() => onPickDate(cell.date)}
                onKeyDown={(e) => e.key === 'Enter' && onPickDate(cell.date)}
              >
                {format(cell.date, 'd')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CALENDAR_COLORS = [
  '#039BE5',
  '#0B57D0',
  '#4CAF50',
  '#FFB300',
  '#F44336',
  '#9C27B0',
  '#FF7043',
  '#607D8B',
];

export function Sidebar(props: {
  currentDate: Date;
  selectedDate: Date;
  onPickDate: (d: Date) => void;
  onCreate?: () => void;
}) {
  const { currentDate, selectedDate, onPickDate, onCreate } = props;
  const [calendars, setCalendars] = useState<ApiCalendar[]>([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    apiFetch<ApiCalendar[]>('/v1/calendars').then((res) => {
      if (res.ok) {
        setCalendars(res.data);
        setVisibleCalendarIds(new Set(res.data.map((c) => c.id)));
      }
    });
  }, []);

  const toggleCalendar = (id: string) => {
    setVisibleCalendarIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <aside className="flex h-full w-56 shrink-0 flex-col gap-4 overflow-y-auto bg-[#F8FAFD] py-2 pt-14 sm:pt-2">
      {/* Create button — Google Calendar style */}
      <div className="px-3">
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-md transition-shadow hover:shadow-lg"
        >
          <PlusIcon size={20} className="text-gray-600" />
          <span>Create</span>
        </button>
      </div>
      {/* Mini calendar */}
      <MiniCalendar currentDate={currentDate} selectedDate={selectedDate} onPickDate={onPickDate} />

      {/* Divider */}
      {calendars.length > 0 && <div className="mx-3" />}

      {/* My Calendars */}
      {calendars.length > 0 && (
        <div className="px-3">
          <p className="mb-2 text-xs font-semibold tracking-wide text-gray-400 uppercase">
            My Calendars
          </p>
          <ul className="space-y-0.5">
            {calendars.map((cal, idx) => {
              const color = cal.color ?? CALENDAR_COLORS[idx % CALENDAR_COLORS.length];
              const isVisible = visibleCalendarIds.has(cal.id);

              return (
                <li key={cal.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => toggleCalendar(cal.id)}
                  >
                    {/* Checkbox-style color swatch */}
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded"
                      style={{
                        backgroundColor: isVisible ? color : 'transparent',
                        border: `2px solid ${color}`,
                      }}
                    >
                      {isVisible && <CheckIcon size={10} className="text-white" strokeWidth={3} />}
                    </span>
                    <span className="truncate">{cal.name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </aside>
  );
}
