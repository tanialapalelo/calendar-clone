type CalendarView = 'year' | 'month' | 'day';

type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  isTask?: boolean;
  isAppointment?: boolean;
  guests?: string[];
  location?: string;
  description?: string;
  notifications?: NotificationItem[];
  visibility?: 'public' | 'private' | 'default';
  busyStatus?: 'free' | 'busy';
};

type NotificationItem = {
  id: string;
  method: string; // e.g. 'notification' | 'email'
  amount: number;
  unit: 'minutes' | 'hours' | 'days' | 'weeks';
};
