import { addDays, addMonths, addYears } from 'date-fns';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './views/DayView';
import { MonthView } from './views/MonthView';
import { YearView } from './views/YearView';

export function CalendarShell(props: {
  view: CalendarView;
  date: Date;
  events: CalendarEvent[];
  onChangeView: (v: CalendarView) => void;
  onChangeDate: (d: Date) => void;
  onNavigate: (next: { view?: CalendarView; date?: Date }) => void;
  onCreateEvent: (d: Date) => void;
  onOpenEvent: (id: string, rect: DOMRect) => void;
  onOpenDayPopover: (d: Date, rect: DOMRect) => void;
}) {
  const {
    view,
    date,
    events,
    onChangeView,
    onChangeDate,
    onNavigate,
    onCreateEvent,
    onOpenEvent,
    onOpenDayPopover,
  } = props;

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
    <div className="min-h-screen">
      <CalendarHeader
        view={view}
        date={date}
        onToday={onToday}
        onPrev={onPrev}
        onNext={onNext}
        onChangeView={onChangeView}
        onCreate={() => onCreateEvent(date)}
      />

      <main className="mx-auto max-w-6xl p-4">
        {view === 'year' && (
          <YearView
            date={date}
            events={events}
            onPickMonth={(d) => {
              onNavigate({ date: d, view: 'month' });
            }}
            onOpenDayPopover={onOpenDayPopover}
          />
        )}
        {view === 'month' && (
          <MonthView
            date={date}
            events={events}
            onSelectDate={(d) => {
              onNavigate({ date: d, view: 'day' });
            }}
            onCreate={(d) => onCreateEvent(d)}
            onOpenEvent={onOpenEvent}
            onOpenDayPopover={onOpenDayPopover}
          />
        )}
        {view === 'day' && <DayView date={date} events={events} onOpenEvent={onOpenEvent} />}
      </main>
    </div>
  );
}
