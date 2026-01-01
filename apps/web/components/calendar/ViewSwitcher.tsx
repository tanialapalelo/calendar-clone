export function ViewSwitcher(props: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const { view, onChange } = props;
  const options = [
    { value: 'year', label: 'Year' },
    { value: 'month', label: 'Month' },
    { value: 'day', label: 'Day' },
  ];
  return (
    <div className="inline-flex gap-2">
      <select
        className="rounded-full border p-1 text-sm"
        value={view}
        onChange={(e) => onChange(e.target.value as CalendarView)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
