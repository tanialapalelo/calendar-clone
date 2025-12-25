import { format } from 'date-fns';
import { ViewSwitcher } from './ViewSwitcher';

type CalendarView = 'year' | 'month' | 'day';

export function CalendarHeader(props: {
  view: CalendarView;
  date: Date;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChangeView: (v: CalendarView) => void;
}) {
  const { view, date, onToday, onPrev, onNext, onChangeView } = props;

  const title = (() => {
    if (view === 'year') return format(date, 'yyyy');
    if (view === 'month') return format(date, 'MMMM yyyy');
    return format(date, 'EEE, MMM d, yyyy');
  })();

  return (
    <header className="flex flex-col gap-3 border-b bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
          onClick={onToday}
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={onPrev}
            aria-label="Previous"
          >
            Prev
          </button>
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            onClick={onNext}
            aria-label="Next"
          >
            Next
          </button>
        </div>

        <h1 className="ml-2 text-base font-semibold text-gray-900">{title}</h1>
      </div>

      <ViewSwitcher view={view} onChange={onChangeView} />
    </header>
  );
}
