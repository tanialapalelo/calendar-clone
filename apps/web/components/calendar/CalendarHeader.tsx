import { format } from 'date-fns';
import { ViewSwitcher } from './ViewSwitcher';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

export function CalendarHeader(props: {
  view: CalendarView;
  date: Date;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChangeView: (v: CalendarView) => void;
  onCreate: (d: Date) => void;
}) {
  const { view, date, onToday, onPrev, onNext, onChangeView, onCreate } = props;

  const title = (() => {
    if (view === 'year') return format(date, 'yyyy');
    if (view === 'month') return format(date, 'MMMM yyyy');
    return format(date, 'EEE, MMM d, yyyy');
  })();

  return (
    <header className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-full border border-black px-3 py-1.5 text-sm hover:bg-gray-100"
          onClick={onToday}
        >
          Today
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-full border-none p-1 text-sm hover:bg-gray-50"
            onClick={onPrev}
            aria-label="Previous"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            className="rounded-full border-none p-1 text-sm hover:bg-gray-50"
            onClick={onNext}
            aria-label="Next"
          >
            <ChevronRightIcon />
          </button>
        </div>

        <h1 className="ml-2 text-base font-semibold text-gray-900">{title}</h1>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-gray-800"
          onClick={() => onCreate(date)}
        >
          Create
        </button>
        <ViewSwitcher view={view} onChange={onChangeView} />
      </div>
    </header>
  );
}
