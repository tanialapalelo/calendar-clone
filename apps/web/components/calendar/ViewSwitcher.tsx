export function ViewSwitcher(props: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const { view, onChange } = props;

  const buttonBase =
    'rounded-md px-3 py-1.5 text-sm font-medium transition border';
  const active = 'bg-gray-900 text-white border-gray-900';
  const inactive = 'bg-white text-gray-900 border-gray-200 hover:bg-gray-50';

  return (
    <div className="inline-flex gap-2">
      <button
        type="button"
        className={`${buttonBase} ${view === 'year' ? active : inactive}`}
        onClick={() => onChange('year')}
      >
        Year
      </button>
      <button
        type="button"
        className={`${buttonBase} ${view === 'month' ? active : inactive}`}
        onClick={() => onChange('month')}
      >
        Month
      </button>
      <button
        type="button"
        className={`${buttonBase} ${view === 'day' ? active : inactive}`}
        onClick={() => onChange('day')}
      >
        Day
      </button>
    </div>
  );
}
