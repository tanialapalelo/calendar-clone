import { viewOptions } from '@/constants';

export function ViewSwitcher(props: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const { view, onChange } = props;

  return (
    <nav
      aria-label="Calendar view"
      className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 p-0.5 dark:border-gray-700 dark:bg-gray-800"
    >
      {viewOptions.map((option) => {
        const active = view === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={`${option.label} view`}
            onClick={() => onChange(option.value as CalendarView)}
            className={[
              'rounded-full px-3 py-1 text-xs font-medium transition-all duration-150',
              active
                ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200',
            ].join(' ')}
          >
            {option.label}
          </button>
        );
      })}
    </nav>
  );
}
