import { addMonths, startOfYear } from 'date-fns';
import { YearMiniView } from '@/components/calendar/views/YearMiniView';

export function YearView(props: {
  date: Date;
  events: CalendarEvent[];
  onPickMonth?: (date: Date) => void;
  onOpenDayPopover: (d: Date, rect: DOMRect) => void;
}) {
  const { date, onPickMonth, onOpenDayPopover } = props;

  const yearStart = startOfYear(date);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(yearStart, i));
  return (
    <div className="rounded-lg bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map((month) => (
          <YearMiniView
            key={month.toISOString()}
            monthDate={month}
            onPickMonth={onPickMonth}
            onOpenDayPopover={onOpenDayPopover}
          />
        ))}
      </div>
    </div>
  );
}
