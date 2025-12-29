import {
  addDays,
  endOfMonth,
  endOfWeek,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export type MonthCell = {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
};

export function generateMonthGrid(anchorDate: Date, today: Date = new Date()): MonthCell[] {
  const monthStart = startOfMonth(anchorDate);
  const monthEnd = endOfMonth(anchorDate);

  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const cells: MonthCell[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    cells.push({
      date: d,
      inCurrentMonth: isSameMonth(d, anchorDate),
      isToday: isSameDay(d, today),
    });
  }
  return cells;
}
