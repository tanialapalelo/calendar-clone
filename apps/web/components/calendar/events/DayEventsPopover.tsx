'use client';

import { addDays, format, isSameDay, parseISO, startOfDay, subMilliseconds } from 'date-fns';
import { useEffect, useMemo, useRef } from 'react';
import { CircleIcon, XIcon } from 'lucide-react';

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

// End-exclusive safe cross-day check (handles all-day stored as [start, nextDayStart))
function isCrossDayTimedEvent(ev: CalendarEvent) {
  if (ev.allDay) return false;
  const start = parseISO(ev.start);
  const endInclusive = subMilliseconds(parseISO(ev.end), 1);
  return !isSameDay(start, endInclusive);
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

  // cross-day first, then all-day, then start time
  const sorted = [...events].sort((a, b) => {
    const aCross = isCrossDayTimedEvent(a) ? 1 : 0;
    const bCross = isCrossDayTimedEvent(b) ? 1 : 0;
    if (aCross !== bCross) return bCross - aCross;

    const aAllDay = a.allDay ? 1 : 0;
    const bAllDay = b.allDay ? 1 : 0;
    if (aAllDay !== bAllDay) return bAllDay - aAllDay;

    return parseISO(a.start).getTime() - parseISO(b.start).getTime();
  });

  const today = new Date();
  const dayStart = startOfDay(date);
  const dayEnd = addDays(dayStart, 1); // exclusive

  return (
    <div className="fixed inset-0 z-[55]">
      <div
        ref={popoverRef}
        className="fixed w-[250px] rounded-3xl bg-white shadow-xl"
        style={{ left: position.left, top: position.top }}
        role="dialog"
        aria-modal="true"
      >
        <div className="max-h-fit overflow-auto px-2 py-2">
          <div className="flex w-full items-center justify-between px-3 pb-2">
            <div className="mx-auto flex w-fit flex-col items-center justify-center text-gray-700">
              <span className="uppercase">{format(date, 'EEE')}</span>
              <span
                className={[
                  'px-3 py-1.5 font-bold',
                  isSameDay(today, date) ? 'rounded-full bg-[#0B57D0] text-white' : '',
                ].join(' ')}
              >
                {format(date, 'd')}
              </span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-1 hover:bg-gray-100">
              <XIcon size={16} />
            </button>
          </div>

          {sorted.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-gray-500">
              There are no events scheduled on this day.
            </div>
          ) : (
            <ul className="space-y-1">
              {sorted.map((ev) => {
                const evStart = parseISO(ev.start);
                const evEnd = parseISO(ev.end);

                const continuesFromPrev = evStart.getTime() < dayStart.getTime();
                const continuesToNext = evEnd.getTime() > dayEnd.getTime();

                const isBar = ev.allDay || isCrossDayTimedEvent(ev);

                // Rounded only if the event actually starts/ends on this day.
                // If it continues, make that side flat so it looks "connected".
                const leftCap = continuesFromPrev ? 'rounded-l-full ' : 'rounded-l-md';
                const rightCap = continuesToNext ? ' rounded-r-full' : 'rounded-r-md';

                const eventColor = ev.color || '#0090d6';
                const containerClass = isBar
                  ? `text-white hover:opacity-80 ${leftCap} ${rightCap}`
                  : 'rounded-md bg-gray-50 hover:bg-gray-100 text-gray-900';

                return (
                  <li key={ev.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-1 text-left ${containerClass}`}
                      onClick={(clickEvt) => {
                        const rect = clickEvt.currentTarget.getBoundingClientRect();
                        onPickEvent(ev.id, rect);
                      }}
                      style={{
                        background: !isBar ? '' : eventColor,
                      }}
                    >
                      <div className="flex items-center gap-2 truncate text-xs font-medium">
                        {!isBar && (
                          <>
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{ background: ev.color ?? '#039BE5' }}
                            />
                            <span>{format(evStart, 'hh:mm a')}</span>
                          </>
                        )}
                        {ev.title}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
