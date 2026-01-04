import type { Metadata } from 'next';
import { format } from 'date-fns';
import CalendarPageClient from '@/components/calendar/CalendarPageClient';

type SearchParams = Record<string, string | string[] | undefined>;

function getFirst(sp: SearchParams, key: string) {
  const v = sp[key];
  if (Array.isArray(v)) return v[0] ?? undefined;
  return v;
}

function parseIsoDateOnly(value: string | undefined): Date {
  if (!value) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return new Date();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? new Date() : dt;
}

function parseView(value: string | undefined): CalendarView {
  if (value === 'year' || value === 'month' || value === 'day') return value;
  return 'month';
}

export function generateMetadata({ searchParams }: { searchParams: SearchParams }): Metadata {
  const view = parseView(getFirst(searchParams, 'view'));
  const date = parseIsoDateOnly(getFirst(searchParams, 'date'));

  let title: string;
  if (view === 'year') title = format(date, 'yyyy') + ' year';
  else if (view === 'day') title = format(date, 'EEEE, MMMM d, yyyy');
  else title = format(date, 'MMMM yyyy');

  return { title };
}

export default function HomePage() {
  return <CalendarPageClient />;
}
