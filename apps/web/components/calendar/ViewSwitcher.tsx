export function ViewSwitcher(props: { view: CalendarView; onChange: (v: CalendarView) => void }) {
  const { view, onChange } = props;

  return (
    <div className="inline-flex gap-2">
      <select
        className="rounded-full border p-1 text-sm"
        value={view}
        onChange={(e) => onChange(e.target.value as CalendarView)}
      >
        <option value="year">Year</option>
        <option value="month">Month</option>
        <option value="day">Day</option>
      </select>
    </div>
  );
}
