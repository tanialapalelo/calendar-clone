'use client';

import { addDays, addMonths, addWeeks, addYears } from 'date-fns';
import { useState } from 'react';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './views/DayView';
import { MonthView } from './views/MonthView';
import { WeekView } from './views/WeekView';
import { YearView } from './views/YearView';
import { Sidebar } from './Sidebar';

export function CalendarShell(props: {
  view: CalendarView;
  date: Date;
  events: CalendarEvent[];
  loading?: boolean;
  onChangeView: (v: CalendarView) => void;
  onChangeDate: (d: Date) => void;
  onNavigate: (next: { view?: CalendarView; date?: Date }) => void;
  onCreateEvent: (d: Date) => void;
  onOpenEvent: (id: string, rect: DOMRect) => void;
  onOpenDayPopover: (d: Date, rect: DOMRect) => void;
  onExportCalendar?: () => void;
  onImportCalendar?: (file: File) => void;
}) {
  const {
    view,
    date,
    events,
    loading = false,
    onChangeView,
    onChangeDate,
    onNavigate,
    onCreateEvent,
    onOpenEvent,
    onOpenDayPopover,
    onExportCalendar,
    onImportCalendar,
  } = props;

  const onToday = () => onChangeDate(new Date());
  // Start open on desktop, closed on mobile (we detect via useState initial)
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const onPrev = () => {
    if (view === 'year') return onChangeDate(addYears(date, -1));
    if (view === 'month') return onChangeDate(addMonths(date, -1));
    if (view === 'week') return onChangeDate(addWeeks(date, -1));
    return onChangeDate(addDays(date, -1));
  };

  const onNext = () => {
    if (view === 'year') return onChangeDate(addYears(date, 1));
    if (view === 'month') return onChangeDate(addMonths(date, 1));
    if (view === 'week') return onChangeDate(addWeeks(date, 1));
    return onChangeDate(addDays(date, 1));
  };

  return (
    <div className="flex min-h-screen flex-col">
      <CalendarHeader
        view={view}
        date={date}
        onToday={onToday}
        onPrev={onPrev}
        onNext={onNext}
        onChangeView={onChangeView}
        onCreate={() => onCreateEvent(date)}
        onExportCalendar={onExportCalendar}
        onImportCalendar={onImportCalendar}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Mobile overlay backdrop — only when sidebar open on small screens */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-20 bg-black/30 sm:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar: togglable on ALL screen sizes.
            Collapsed state: narrow 48px strip showing only the + button (desktop).
            Mobile: slides off-screen entirely when closed. */}
        <div
          className={[
            'z-30 shrink-0 transition-all duration-200 ease-in-out',
            'fixed inset-y-0 left-0 sm:relative sm:inset-auto',
            sidebarOpen ? 'w-56 translate-x-0' : '-translate-x-full sm:w-12 sm:translate-x-0',
          ].join(' ')}
        >
          {/* Full sidebar — visible when open */}
          <div className={sidebarOpen ? 'block' : 'hidden'}>
            <Sidebar
              currentDate={date}
              selectedDate={date}
              onPickDate={(d) => {
                onNavigate({ date: d, view: 'day' });
                setSidebarOpen(false);
              }}
              onCreate={() => onCreateEvent(date)}
            />
          </div>

          {/* Collapsed strip — visible on desktop when sidebar is closed */}
          {!sidebarOpen && (
            <div className="hidden h-full w-12 flex-col items-center border-r border-gray-100 bg-[#F8FAFD] pt-3 sm:flex">
              <button
                type="button"
                onClick={() => onCreateEvent(date)}
                title="Create event"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md transition-shadow hover:shadow-lg"
                aria-label="Create event"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-5 w-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M12 5v14M5 12h14" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <main className="relative flex-1 overflow-auto p-2 sm:p-4">
          {/* Loading spinner */}
          {loading && (
            <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-16">
              <div className="flex flex-col items-center gap-3">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#0B57D0] border-t-transparent" />
                <span className="text-sm text-gray-500">Loading events…</span>
              </div>
            </div>
          )}

          {view === 'year' && (
            <YearView
              date={date}
              events={events}
              onPickMonth={(d) => onNavigate({ date: d, view: 'month' })}
              onOpenDayPopover={onOpenDayPopover}
            />
          )}
          {view === 'month' && (
            <MonthView
              date={date}
              events={events}
              onSelectDate={(d) => onNavigate({ date: d, view: 'day' })}
              onCreate={(d) => onCreateEvent(d)}
              onOpenEvent={onOpenEvent}
              onOpenDayPopover={onOpenDayPopover}
            />
          )}
          {view === 'week' && (
            <WeekView
              date={date}
              events={events}
              onOpenEvent={onOpenEvent}
              onCreateEvent={onCreateEvent}
            />
          )}
          {view === 'day' && <DayView date={date} events={events} onOpenEvent={onOpenEvent} />}
        </main>
      </div>
    </div>
  );
}
