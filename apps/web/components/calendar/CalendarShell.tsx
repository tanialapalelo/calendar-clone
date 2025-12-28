import { addDays, addMonths, addYears } from 'date-fns';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './views/DayView';
import { MonthView } from './views/MonthView';
import { YearView } from './views/YearView';
import * as events from 'node:events';

export function CalendarShell(props: {
  view: CalendarView;
  date: Date;
  events: CalendarEvent[];
  onChangeView: (v: CalendarView) => void;
  onChangeDate: (d: Date) => void;
  onNavigate: (next: { view?: CalendarView; date?: Date }) => void;
  onCreateEvent: () => void;
}) {
  const { view, date, events, onChangeView, onChangeDate, onNavigate, onCreateEvent } = props;

  const onToday = () => onChangeDate(new Date());

  const onPrev = () => {
    if (view === 'year') return onChangeDate(addYears(date, -1));
    if (view === 'month') return onChangeDate(addMonths(date, -1));
    return onChangeDate(addDays(date, -1));
  };

  const onNext = () => {
    if (view === 'year') return onChangeDate(addYears(date, 1));
    if (view === 'month') return onChangeDate(addMonths(date, 1));
    return onChangeDate(addDays(date, 1));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <CalendarHeader
        view={view}
        date={date}
        onToday={onToday}
        onPrev={onPrev}
        onNext={onNext}
        onChangeView={onChangeView}
        onCreate={onCreateEvent}
      />

      <main className="mx-auto max-w-6xl p-4">
        {view === 'year' && (
          <YearView
            date={date}
            onPickMonth={(d) => {
              onNavigate({ date: d, view: 'month' });
            }}
          />
        )}
        {view === 'month' && (
          <MonthView
            date={date}
            events={events}
            onSelectDate={(d) => {
              onNavigate({ date: d, view: 'day' });
            }}
          />
        )}
        {view === 'day' && <DayView date={date} />}
      </main>
    </div>
  );
}
