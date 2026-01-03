type CalendarView = 'year' | 'month' | 'day';

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  isTask?: boolean;
  isAppointment?: boolean;
};
type WeekEventSegment = {
  event: CalendarEvent;
  startCol: number; // 0–6
  endCol: number; // 0–6
};
