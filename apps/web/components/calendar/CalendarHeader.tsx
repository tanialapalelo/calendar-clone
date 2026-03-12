import { format } from 'date-fns';
import { ViewSwitcher } from './ViewSwitcher';
import { ChevronLeftIcon, ChevronRightIcon, MenuIcon } from 'lucide-react';
import { useRef } from 'react';
import { UserMenu } from '@/components/auth/UserMenu';
import { SettingsMenu } from '@/components/ui/SettingsMenu';

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
  } = props;

  // kept for potential future use (e.g. keyboard shortcut)
  const _fileInputRef = useRef<HTMLInputElement | null>(null);

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

      {/* Right: ViewSwitcher + Settings + UserMenu */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <ViewSwitcher view={view} onChange={onChangeView} />

        <SettingsMenu onExportCalendar={onExportCalendar} onImportCalendar={onImportCalendar} />

        <div className="h-5 w-px bg-gray-200 dark:bg-gray-600" />
        <UserMenu />
      </div>
    </header>
  );
}
