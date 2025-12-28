type CalendarView = 'year' | 'month' | 'day';

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
};
