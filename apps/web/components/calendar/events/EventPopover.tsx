'use client';

import { format, parseISO } from 'date-fns';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PencilIcon, Trash2Icon, XIcon } from 'lucide-react';

type Props = {
  open: boolean;
  anchorRect: DOMRect | null;
  event: CalendarEvent | null;
  onClose: () => void;
  onUpdate: (event: CalendarEvent) => void;
  onDelete: (id: string) => void;
};

function toLocalDateTimeInputValue(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function EventPopover({ open, anchorRect, event, onClose, onUpdate, onDelete }: Props) {
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  // Reset form whenever we open on a new event
  useEffect(() => {
    if (!open || !event) return;
    setEditing(false);
    setTitle(event.title ?? '');
    setStart(toLocalDateTimeInputValue(parseISO(event.start)));
    setEnd(toLocalDateTimeInputValue(parseISO(event.end)));
  }, [open, event?.id]);

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

    const onMouseDown = (e: MouseEvent) => {
      const el = popoverRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) onClose();
    };

    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [open, onClose]);

  const position = useMemo(() => {
    if (!anchorRect) return null;

    // Place to the right of the event; fall back to left if near edge
    const POPOVER_W = 320;
    const POPOVER_H = 220; // approx; ok for MVP
    const GAP = 10;

    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const preferredLeft = anchorRect.right + GAP;
    const canFitRight = preferredLeft + POPOVER_W <= vw - 8;

    const left = canFitRight ? preferredLeft : anchorRect.left - GAP - POPOVER_W;

    const top = clamp(anchorRect.top, 8, vh - POPOVER_H - 8);

    return { left: Math.max(8, left), top };
  }, [anchorRect]);

  if (!open || !event || !anchorRect || !position) return null;

  const submitEdit = () => {
    onUpdate({
      ...event,
      title: title.trim(),
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
    setEditing(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60]">
      <div
        ref={popoverRef}
        className="fixed w-[320px] rounded-3xl border border-gray-200 bg-white shadow-xl"
        style={{ left: position.left, top: position.top }}
        role="dialog"
        aria-modal="true"
      >
        <div className="m-2 flex justify-end gap-1">
          <button
            type="button"
            className="rounded-full p-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={() => setEditing(true)}
          >
            <PencilIcon size={16} />
          </button>
          <button
            type="button"
            className="rounded-full p-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={() => {
              if (confirm('Delete this event?')) {
                onDelete(event.id);
                onClose();
              }
            }}
          >
            <Trash2Icon size={16} />
          </button>
          <button
            type="button"
            className="ml-3 rounded-full p-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </div>
        <div className="items-start justify-between gap-3 border-b border-gray-100 px-4 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-900">{event.title}</div>
            <div className="mt-0.5 text-xs text-gray-500">
              {format(parseISO(event.start), 'EEE, MMM d · HH:mm')} –{' '}
              {format(parseISO(event.end), 'HH:mm')}
            </div>
          </div>
        </div>

        {editing && (
          <div className="space-y-3 px-4 py-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-gray-600">Title</label>
              <input
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                autoFocus
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-600">Start</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-600">End</label>
                <input
                  type="datetime-local"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
                onClick={submitEdit}
              >
                Save
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
