'use client';

import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { XIcon } from 'lucide-react';

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  date: Date | null;
  events: CalendarEvent[];
  onClose: () => void;
  onPickEvent: (eventId: string, rect: DOMRect) => void;
  disableOutsideClose?: boolean;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function DayEventsPopover({
  open,
  anchorRect,
  date,
  events,
  onClose,
  onPickEvent,
  disableOutsideClose,
}: Props) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  // Click outside to close
  useEffect(() => {
    if (!open) return;
    if (disableOutsideClose) return;

    const onMouseDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [open, onClose, disableOutsideClose]);

  const position = useMemo(() => {
    if (!anchorRect) return null;

    const W = 320;
    const H = 320;
    const GAP = 10;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const preferredLeft = anchorRect.right + GAP;
    const canFitRight = preferredLeft + W <= vw - 8;
    const left = canFitRight ? preferredLeft : anchorRect.left - GAP - W;

    const top = clamp(anchorRect.top, 8, vh - H - 8);
    return { left: Math.max(8, left), top };
  }, [anchorRect]);

  if (!open || !anchorRect || !date || !position) return null;

  const sorted = [...events].sort(
    (a, b) => parseISO(a.start).getTime() - parseISO(b.start).getTime(),
  );

  return (
    <div className="fixed inset-0 z-[55]">
      <div
        ref={popoverRef}
        className="fixed w-[320px] rounded-3xl bg-white shadow-xl"
        style={{ left: position!.left, top: position!.top }}
        role="dialog"
        aria-modal="true"
      >
        <div className="max-h-[260px] overflow-auto px-2 py-2">
          <div className="flex w-full items-center justify-between border-b px-3 pb-2">
            <div className="flex flex-col text-gray-700">
              <span className="uppercase">{format(date, 'EEE')}</span>
              <span className="font-bold">{format(date, 'd')}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
              <XIcon className="h-6 w-6 text-gray-400" />
            </button>
          </div>
          {sorted.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              There are no events scheduled on this day.
            </div>
          ) : (
            <div>
              <ul className="space-y-1">
                {sorted.map((ev) => (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-gray-50"
                      onClick={(clickEvt) => {
                        const rect = clickEvt.currentTarget.getBoundingClientRect();
                        onPickEvent(ev.id, rect);
                      }}
                    >
                      <div className="truncate text-sm font-medium text-gray-900">{ev.title}</div>
                      <div className="text-xs text-gray-500">
                        {format(parseISO(ev.start), 'HH:mm')} – {format(parseISO(ev.end), 'HH:mm')}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
