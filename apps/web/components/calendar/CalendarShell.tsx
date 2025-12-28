import { addDays, addMonths, addYears } from 'date-fns';
import { CalendarHeader } from './CalendarHeader';
import { DayView } from './views/DayView';
import { MonthView } from './views/MonthView';
import { YearView } from './views/YearView';

export function CalendarShell(props: {
  view: CalendarView;
  date: Date;
  onChangeView: (v: CalendarView) => void;
  onChangeDate: (d: Date) => void;
}) {
  const { view, date, onChangeView, onChangeDate } = props;

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
      />

      <main className="mx-auto max-w-6xl p-4">
        {view === 'year' && <YearView />}
        {view === 'month' && (
          <MonthView
            date={date}
            onSelectDate={(d) => {
              onChangeDate(d);
              onChangeView('day')
            }}
          />
        )}
        {view === 'day' && <DayView date={date} />}
      </main>
    </div>
  );
}
