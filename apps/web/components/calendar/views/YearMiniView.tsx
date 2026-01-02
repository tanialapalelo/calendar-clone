import { format } from 'date-fns';
import { generateMonthGrid } from '@/lib/month-grid';
import { shortDaysOfWeek } from '@/constants';

export function YearMiniView(props: {
  monthDate: Date;
  onPickMonth?: (date: Date) => void;
  onOpenDayPopover?: (date: Date, rect: DOMRect) => void;
}) {
  const { monthDate, onPickMonth, onOpenDayPopover } = props;

  const cells = generateMonthGrid(monthDate);

  return (
    <button type="button" className="w-full p-3 text-left">
      <div className="mb-2 text-sm font-semibold text-gray-900">{format(monthDate, 'MMMM')}</div>
      <div className="mx-auto grid grid-cols-7 gap-y-1 text-center text-[10px] text-gray-600">
        {shortDaysOfWeek.map((d, i) => (
          <div key={`${d}-${i}`} className="text-center font-semibold">
            {d}
          </div>
        ))}
        {cells.map((cell) => (
          <div
            key={cell.date.toISOString()}
            className={`text-center ${cell.isToday ? 'bg-[#0B57D0] font-bold text-white' : 'hover:bg-gray-100'} mx-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-full`}
            onClick={(clickEvt) => {
              clickEvt.stopPropagation();
              const rect = clickEvt.currentTarget.getBoundingClientRect();
              onOpenDayPopover?.(cell.date, rect);
            }}
          >
            {format(cell.date, 'd')}
          </div>
        ))}
      </div>
    </button>
  );
}
