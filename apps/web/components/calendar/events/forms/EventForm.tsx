'use client';

import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { KeyboardEvent, useMemo, useState } from 'react';
import { toLocalDateTimeInputValue } from '@/lib/date';
import { MapPinIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

function startOfDayLocal(d: Date) {
  const dt = new Date(d);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function ensureDateTimeInputValueFrom(value: string, preferHour = 9) {
  try {
    const d = parseISO(value);
    if (d.getHours() === 0 && d.getMinutes() === 0) {
      d.setHours(preferHour, 0, 0, 0);
    }
    return toLocalDateTimeInputValue(d);
  } catch {
    return value;
  }
}

type Props = {
  initialDate: Date;
  onClose: () => void;
  onCreate: (event: CalendarEvent & { guests?: string[]; location?: string }) => void;
};

export function EventForm({ initialDate, onClose, onCreate }: Props) {
  const initialStart = useMemo(() => new Date(initialDate), [initialDate]);
  const initialEnd = useMemo(() => addMinutes(new Date(initialDate), 60), [initialDate]);
  const defaultStart = useMemo(() => startOfDayLocal(initialStart), [initialStart]);
  const defaultEnd = useMemo(() => addDays(startOfDayLocal(initialEnd), 1), [initialEnd]);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(toLocalDateTimeInputValue(defaultStart));
  const [end, setEnd] = useState(toLocalDateTimeInputValue(defaultEnd));
  const [showTime, setShowTime] = useState(false);
  const [allDay, setAllDay] = useState(true);

  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [location, setLocation] = useState('');

  const router = useRouter();

  const submit = () => {
    let startDate: Date;
    let endDate: Date;
    if (allDay) {
      startDate = startOfDayLocal(new Date(start));
      endDate = addDays(startOfDayLocal(new Date(end)), 1);
    } else {
      startDate = new Date(start);
      endDate = new Date(end);
    }

    onCreate({
      id: crypto.randomUUID(),
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay,
      guests: guests.length ? guests : undefined,
      location: location || undefined,
      color: '#0B57D0',
    });
    onClose();
  };

  const addGuest = () => {
    const trimmed = guestInput.trim();
    if (!trimmed) return;
    setGuests((prev) => [...prev, trimmed]);
    setGuestInput('');
  };

  const onGuestInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addGuest();
    }
  };

  const onClickAddTime = () => {
    setShowTime(true);
    setAllDay(false);
    setStart((prev) => ensureDateTimeInputValueFrom(prev, 9));
    setEnd((prev) => ensureDateTimeInputValueFrom(prev, 10));
  };

  const onToggleAllDayWhenShown = (checked: boolean) => {
    setAllDay(checked);
    if (checked) {
      const s = startOfDayLocal(new Date(start));
      const e = addDays(startOfDayLocal(new Date(start)), 1);
      setStart(toLocalDateTimeInputValue(s));
      setEnd(toLocalDateTimeInputValue(e));
      setShowTime(false);
    } else {
      setShowTime(true);
      setStart((prev) => ensureDateTimeInputValueFrom(prev, 9));
      setEnd((prev) => ensureDateTimeInputValueFrom(prev, 10));
    }
  };

  const onMoreOptions = () => {
    // navigate to full editor and pass initial date as YYYY-MM-DD
    const dateStr = format(initialDate, 'yyyy-MM-dd');
    // close modal then navigate
    onClose();
    router.push(`/events/new?date=${encodeURIComponent(dateStr)}`);
  };

  return (
    <div className="space-y-3 bg-[#F0F4F9] px-4 py-4">
      <div>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 items-end gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">Start</label>
          <input
            type={allDay ? 'date' : 'datetime-local'}
            className="w-full rounded border px-3 py-2 text-sm"
            value={allDay ? start.slice(0, 10) : start}
            onChange={(e) => {
              const v = e.target.value;
              setStart(allDay ? `${v}T00:00` : v);
            }}
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-600">End</label>
          <input
            type={allDay ? 'date' : 'datetime-local'}
            className="w-full rounded border px-3 py-2 text-sm"
            value={allDay ? end.slice(0, 10) : end}
            onChange={(e) => {
              const v = e.target.value;
              setEnd(allDay ? `${v}T00:00` : v);
            }}
          />
        </div>

        <div className="col-span-2 flex justify-end">
          {!showTime ? (
            <button
              type="button"
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100"
              onClick={onClickAddTime}
            >
              Add time
            </button>
          ) : (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => onToggleAllDayWhenShown(e.target.checked)}
              />
              All day
            </label>
          )}
        </div>
      </div>

      {/* Guests */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <UsersIcon size={16} />
          <input
            className="flex-1 rounded border px-3 py-2 text-sm"
            value={guestInput}
            onChange={(e) => setGuestInput(e.target.value)}
            onKeyDown={onGuestInputKey}
            placeholder="Add guest and press Enter"
          />
          <button
            type="button"
            className="rounded px-3 py-1 text-sm text-gray-700 hover:bg-gray-100"
            onClick={addGuest}
          >
            Add
          </button>
        </div>

        {guests.length > 0 && (
          <div className="space-y-1">
            {guests.map((g, i) => (
              <div
                key={`${g}-${i}`}
                className="flex items-center justify-between gap-2 px-1 py-1 hover:bg-gray-100"
              >
                <span className="text-sm text-gray-700">{g}</span>
                <button
                  type="button"
                  className="rounded-full px-2 py-1 text-sm hover:bg-gray-200"
                  onClick={() => setGuests((prev) => prev.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 border-t pt-3">
        <MapPinIcon size={16} />
        <input
          className="flex-1 rounded border px-3 py-2 text-sm"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Add location"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <button
          type="button"
          className="rounded-3xl px-3 py-2 text-sm text-blue-700 hover:bg-blue-100"
          onClick={onMoreOptions}
        >
          More Options
        </button>
        <button
          type="button"
          className="rounded-3xl bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#044dc2]"
          onClick={submit}
        >
          Save
        </button>
      </div>
    </div>
  );
}
