import { format } from 'date-fns';
import { generateMonthGrid } from '@/lib/month-grid';

export function YearMiniView(props: { monthDate: Date; onPickMonth?: (date: Date) => void }) {
  const { monthDate, onPickMonth } = props;

  const cells = generateMonthGrid(monthDate);
  const daysOfWeek = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <button
      type="button"
      onClick={() => onPickMonth?.(monthDate)}
      className="rounded-lg border bg-white p-3 text-left hover:bg-gray-50 focus:ring-2 focus:ring-gray-900 focus:outline-none"
    >
      <div className="mb-2 text-sm font-semibold text-gray-900">{format(monthDate, 'MMM')}</div>
      <div className="grid grid-cols-7 gap-y-1 text-[10px] text-gray-600">
        {daysOfWeek.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center font-semibold">
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.date.toISOString()}
            className={`text-center ${
              cell.inCurrentMonth ? 'text-gray-900' : 'text-gray-300'
            } ${cell.isToday ? 'bg-gray-900 font-bold text-white' : ''}`}
          >
            {format(cell.date, 'd')}
          </div>
        ))}
      </div>
    </button>
  );
}
