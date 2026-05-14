type CalendarView = 'year' | 'month' | 'week' | 'day';

type CalendarEvent = {
  id: string;
  calendarId?: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  startDate?: string;
  endDate?: string;
  isTask?: boolean;
  isAppointment?: boolean;
  guests?: string[];
  location?: string;
  description?: string;
  notifications?: NotificationItem[];
  visibility?: 'public' | 'private' | 'default';
  busyStatus?: 'free' | 'busy';
  recurrence?: string | null;
  recurringEventId?: string | null;
  originalStartAt?: string | null;
  isRecurringInstance?: boolean;
  color: string;
};

type PositionedEvent = {
  event: CalendarEvent;
  startMin: number;
  endMin: number;
  col: number;
  colCount: number;
};

type NotificationItem = {
  id: string;
  method: string; // e.g. 'notification' | 'email'
  amount: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
  anchor?: 'start' | 'end';
};

type RecurrenceValue = {
  rrule?: string | null;
};
