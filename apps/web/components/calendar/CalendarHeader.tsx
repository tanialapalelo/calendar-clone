'use client';

import { addDays, format, startOfWeek } from 'date-fns';
import { ViewSwitcher } from './ViewSwitcher';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  MenuIcon,
  SearchIcon,
  ChevronDownIcon,
} from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/ui/SettingsMenu';
import { apiFetch } from '@/lib/api/client';
import { apiEventToCalendarEvent, type ApiEvent } from '@/lib/api/events';
import { DatePickerPopover } from '@/components/calendar/DatePickerPopover';

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function SearchBar(props: { onOpenEvent: (id: string, rect: DOMRect) => void }) {
  const { onOpenEvent } = props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<CalendarEvent[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
  if (!debouncedQuery.trim()) return;
    setLoading(true);
    const qs = new URLSearchParams({ q: debouncedQuery });
    apiFetch<ApiEvent[]>(`/v1/events/search?${qs.toString()}`)
      .then((data) => {
        setResults(data.map(apiEventToCalendarEvent));
        setOpen(true);
      })
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, [debouncedQuery]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 dark:bg-gray-800">
        <SearchIcon size={15} className="shrink-0 text-gray-500" />
        <input
          type="search"
          aria-label="Search events"
          placeholder="Search events"
          value={query}
          className="w-48 bg-transparent text-sm text-gray-700 placeholder-gray-400 outline-none dark:text-gray-200"
          onChange={(e) => {
            const v = e.target.value;
            setQuery(v);
            if (!v.trim()) {
              setResults([]);
              setOpen(false);
            }
          }}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery('');
              setResults([]);
              setOpen(false);
            }}
          />
        )}
      </div>

      {open && (
        <div className="absolute top-10 left-0 z-50 w-80 rounded-2xl border border-gray-200 bg-white py-2 shadow-xl dark:border-gray-700 dark:bg-gray-800">
          {loading && <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-gray-400">No results found</p>
          )}
          {!loading &&
            results.map((ev) => (
              <button
                key={ev.id}
                type="button"
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left text-[var(--gcal-text-muted,#70757a)] hover:bg-[var(--gcal-bg-hover,#f1f3f4)] dark:text-gray-300 dark:hover:bg-gray-700"
                onClick={(e) => {
                  onOpenEvent(ev.id, e.currentTarget.getBoundingClientRect());
                  setOpen(false);
                  setQuery('');
                }}
              >
                <span
                  className="mt-0.5 h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: ev.color }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--gcal-text-muted,#70757a)] hover:bg-[var(--gcal-bg-hover,#f1f3f4)] dark:text-gray-300 dark:hover:bg-gray-700">
                    {ev.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(ev.start), 'MMM d, yyyy · HH:mm')}
                  </p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function CalendarHeader(props: {
  view: CalendarView;
  date: Date;
  onToday: () => void;
  onPrev: () => void;
  onNext: () => void;
  onChangeView: (v: CalendarView) => void;
  onChangeDate?: (d: Date) => void;
  onCreate: (kind?: CreateKind) => void;
  onExportCalendar?: () => void;
  onImportCalendar?: (file: File) => void;
  onToggleSidebar?: () => void;
  onOpenEvent?: (id: string, rect: DOMRect) => void;
  sidebarOpen?: boolean;
}) {
  const {
    view,
    date,
    onToday,
    onPrev,
    onNext,
    onChangeView,
    onChangeDate,
    onExportCalendar,
    onImportCalendar,
    onToggleSidebar,
    onOpenEvent,
    sidebarOpen = true,
  } = props;
  const titleIsPicker = !sidebarOpen;
  const title = (() => {
    if (view === 'year') return format(date, 'yyyy');
    if (view === 'month') return format(date, 'MMMM yyyy');
    if (view === 'day') return format(date, 'MMMM d, yyyy');

    // Week view — show "May 2026" if all days are in the same month;
    // otherwise "Apr – May 2026" (Google parity for spanning weeks).
    const weekStart = startOfWeek(date, { weekStartsOn: 0 });
    const weekEnd = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === weekEnd.getMonth();
    if (sameMonth) return format(date, 'MMMM yyyy');
    return `${format(weekStart, 'MMM')} – ${format(weekEnd, 'MMM yyyy')}`;
  })();

  // --- date picker popover state ---
  const titleBtnRef = useRef<HTMLButtonElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);

  const openPicker = () => {
    if (titleBtnRef.current) {
      setPickerRect(titleBtnRef.current.getBoundingClientRect());
      setPickerOpen(true);
    }
  };

  // Keep the popover anchored when the window resizes
  useEffect(() => {
    if (!pickerOpen) return;
    const onResize = () => {
      if (titleBtnRef.current) setPickerRect(titleBtnRef.current.getBoundingClientRect());
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pickerOpen]);

  return (
    <>
      <header className="flex items-center justify-between gap-2 px-3 py-2 text-xs sm:px-4 sm:py-3 md:text-base">
        {/* Left: Hamburger + logo + Today + prev/next + title */}
        <div className="flex min-w-0 items-center gap-1 sm:gap-2">
          <button
            type="button"
            className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-gray-100 sm:h-10 sm:w-10 dark:hover:bg-gray-700"
            onClick={onToggleSidebar}
            aria-label="Toggle sidebar"
          >
            <MenuIcon size={20} />
          </button>

          {/* App logo — small and unobtrusive (NOT a clone of Google's). */}
          <div className="mr-1 hidden h-7 w-7 items-center justify-center rounded-md bg-[#1a73e8] sm:flex">
            <span className="font-bold text-white">{format(new Date(), 'd')}</span>
          </div>

          <span className="hidden font-medium text-gray-700 sm:inline dark:text-gray-300">
            Calendar
          </span>

          <button
            type="button"
            className="shrink-0 rounded-full border border-gray-300 px-2 py-1 font-medium hover:bg-gray-100 sm:px-3 sm:py-1.5 dark:border-gray-600 dark:hover:bg-gray-700"
            onClick={onToday}
          >
            Today
          </button>

          <div className="flex items-center">
            <button
              type="button"
              className="rounded-full p-0 hover:bg-gray-100 sm:p-1 dark:hover:bg-gray-700"
              onClick={onPrev}
              aria-label="Previous"
            >
              <ChevronLeftIcon size={18} />
            </button>
            <button
              type="button"
              className="rounded-full p-0 hover:bg-gray-100 sm:p-1 dark:hover:bg-gray-700"
              onClick={onNext}
              aria-label="Next"
            >
              <ChevronRightIcon size={18} />
            </button>
          </div>

          {titleIsPicker ? (
            <button
              ref={titleBtnRef}
              type="button"
              onClick={openPicker}
              aria-haspopup="dialog"
              aria-expanded={pickerOpen}
              className="group flex items-center gap-1 rounded-full px-0 py-1 hover:bg-gray-100 sm:px-2 dark:hover:bg-gray-700"
            >
              <span className="truncate font-semibold text-gray-900 dark:text-gray-100">
                {title}
              </span>
              <ChevronDownIcon
                size={16}
                className="text-gray-500 transition-transform group-aria-expanded:rotate-180"
              />
            </button>
          ) : (
            <span className="truncate px-2 py-1 font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </span>
          )}
        </div>

        {/* Right: Search + ViewSwitcher + Settings + UserMenu */}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {onOpenEvent && <SearchBar onOpenEvent={onOpenEvent} />}

          <ViewSwitcher view={view} onChange={onChangeView} />

          <SettingsMenu onExportCalendar={onExportCalendar} onImportCalendar={onImportCalendar} />

          <div className="h-5 w-px bg-gray-200 dark:bg-gray-600" />
          <UserMenu />
        </div>
      </header>

      {titleIsPicker && (
        <DatePickerPopover
          open={pickerOpen}
          anchorRect={pickerRect}
          selected={date}
          onSelect={(d) => onChangeDate?.(d)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </>
  );
}
