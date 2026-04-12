'use client';

import { format } from 'date-fns';
import { ViewSwitcher } from './ViewSwitcher';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon, SearchIcon, XIcon } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/ui/SettingsMenu';
import { apiFetch } from '@/lib/api/client';
import { apiEventToCalendarEvent, type ApiEvent } from '@/lib/api/events';

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
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
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
            setQuery(e.target.value);
            if (!e.target.value.trim()) setOpen(false);
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
          >
            <XIcon size={13} className="text-gray-400 hover:text-gray-600" />
          </button>
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
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700"
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
                  <p className="truncate text-sm font-medium text-gray-800 dark:text-gray-100">
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
  onCreate: () => void;
  onExportCalendar?: () => void;
  onImportCalendar?: (file: File) => void;
  onToggleSidebar?: () => void;
  onOpenEvent?: (id: string, rect: DOMRect) => void;
}) {
  const {
    view,
    date,
    onToday,
    onPrev,
    onNext,
    onChangeView,
    onExportCalendar,
    onImportCalendar,
    onToggleSidebar,
    onOpenEvent,
  } = props;

  const title = (() => {
    if (view === 'year') return format(date, 'yyyy');
    if (view === 'month') return format(date, 'MMMM yyyy');
    return format(date, 'MMMM d, yyyy');
  })();

  return (
    <header className="flex items-center justify-between gap-2 px-3 py-2 sm:px-4 sm:py-3">
      {/* Left: Hamburger + logo + Today + prev/next + title */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        <button
          type="button"
          className="rounded-full p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onToggleSidebar}
          aria-label="Toggle sidebar"
        >
          <MenuIcon size={20} />
        </button>

        <div className="mr-1 hidden h-8 w-8 items-center justify-center rounded-xl bg-[#0B57D0] sm:flex">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="h-5 w-5 text-white"
            stroke="currentColor"
            strokeWidth={2}
          >
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
        </div>

        <button
          type="button"
          className="shrink-0 rounded-full border border-gray-300 px-2 py-1 text-xs font-medium hover:bg-gray-100 sm:px-3 sm:py-1.5 sm:text-sm dark:border-gray-600 dark:hover:bg-gray-700"
          onClick={onToday}
        >
          Today
        </button>

        <div className="flex items-center">
          <button
            type="button"
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onPrev}
            aria-label="Previous"
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button
            type="button"
            className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={onNext}
            aria-label="Next"
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>

        <h1 className="truncate text-sm font-semibold text-gray-900 sm:text-base dark:text-gray-100">
          {title}
        </h1>
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
  );
}
