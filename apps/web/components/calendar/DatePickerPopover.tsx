'use client';

import { addMonths, format, isSameDay, isSameMonth, startOfMonth, subMonths } from 'date-fns';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { generateMonthGrid } from '@/lib/month-grid';

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  selected: Date;
  onSelect: (d: Date) => void;
  onClose: () => void;
};

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] as const;

/**
 * Mini month picker that pops out from the calendar title (Google-Calendar parity).
 * Anchors to a DOMRect so it can be reused from anywhere (header, modal, etc).
 */
export function DatePickerPopover({ open, anchorRect, selected, onSelect, onClose }: Props) {
  const [cursor, setCursor] = useState<Date>(startOfMonth(selected));
  const ref = useRef<HTMLDivElement>(null);

  // Reset cursor whenever the popover opens for a new selected date.
  useEffect(() => {
    if (open) setCursor(startOfMonth(selected));
  }, [open, selected]);

  // Close on outside click / Escape
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Defer to next tick so the click that opened it isn't caught.
    const t = setTimeout(() => document.addEventListener('mousedown', onDocClick), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const cells = useMemo(() => generateMonthGrid(cursor), [cursor]);

  if (!open || !anchorRect) return null;

  // Position below the anchor (header title). Clamp inside viewport.
  const POPOVER_W = 280;
  const top = anchorRect.bottom + 8;
  const left = Math.min(
    Math.max(8, anchorRect.left),
    typeof window !== 'undefined' ? window.innerWidth - POPOVER_W - 8 : anchorRect.left,
  );

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Pick a date"
      className="fixed z-50 w-[280px] rounded-2xl border border-[var(--gcal-border,#dadce0)] bg-white p-3 shadow-xl"
      style={{ top, left }}
    >
      {/* Month nav */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-[var(--gcal-text,#3c4043)]">
          {format(cursor, 'MMMM yyyy')}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Previous month"
            className="rounded-full p-1 hover:bg-gray-100"
            onClick={() => setCursor((c) => subMonths(c, 1))}
          >
            <ChevronLeftIcon size={16} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="rounded-full p-1 hover:bg-gray-100"
            onClick={() => setCursor((c) => addMonths(c, 1))}
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
      </div>

      {/* Weekday header */}
      <div className="grid grid-cols-7 text-center text-[11px] text-[var(--gcal-text-muted,#70757a)]">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 text-center text-[13px]">
        {cells.map((cell) => {
          const isSelected = isSameDay(cell.date, selected);
          const inMonth = isSameMonth(cell.date, cursor);
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              onClick={() => {
                onSelect(cell.date);
                onClose();
              }}
              className={[
                'mx-auto my-0.5 flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                isSelected
                  ? 'bg-[#1a73e8] text-white hover:bg-[#1a73e8]'
                  : cell.isToday
                    ? 'font-medium text-[#1a73e8] hover:bg-gray-100'
                    : inMonth
                      ? 'text-[var(--gcal-text,#3c4043)] hover:bg-gray-100'
                      : 'text-gray-400 hover:bg-gray-50',
              ].join(' ')}
            >
              {format(cell.date, 'd')}
            </button>
          );
        })}
      </div>
    </div>
  );
}
