'use client';

import { addMinutes, format } from 'date-fns';
import { useMemo, useState, useEffect } from 'react';

function toLocalDateTimeInputValue(d: Date) {
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

type Props = {
  open: boolean;
  initialDate: Date;
  onClose: () => void;
  onCreate: (event: CalendarEvent) => void;
};

export function CreateEventModal({ open, initialDate, onClose, onCreate }: Props) {
  const initialStart = useMemo(() => new Date(initialDate), [initialDate]);
  const initialEnd = useMemo(() => addMinutes(new Date(initialDate), 60), [initialDate]);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(toLocalDateTimeInputValue(initialStart));
  const [end, setEnd] = useState(toLocalDateTimeInputValue(initialEnd));

  useEffect(() => {
    if (!open) return;

    setTitle('');
    setStart(toLocalDateTimeInputValue(initialStart));
    setEnd(toLocalDateTimeInputValue(initialEnd));
  }, [open, initialStart, initialEnd]);

  if (!open) return null;

  const submit = () => {
    onCreate({
      id: crypto.randomUUID(),
      title,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
    });
    setTitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-lg">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Create event</div>
            <div className="text-xs text-gray-500">{format(initialDate, 'EEE, MMM d, yyyy')}</div>
          </div>

          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="space-y-3 px-4 py-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Title</label>
            <input
              className="w-full rounded border px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Team sync"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">Start</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2 text-sm"
                value={start}
                onChange={(e) => setStart(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-gray-600">End</label>
              <input
                type="datetime-local"
                className="w-full rounded border px-3 py-2 text-sm"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button
            type="button"
            className="rounded px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="rounded bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            onClick={submit}
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
