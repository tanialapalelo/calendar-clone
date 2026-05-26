'use client';

import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { KeyboardEvent, useMemo, useState } from 'react';
import { toLocalDateTimeInputValue } from '@/lib/date';
import { MapPinIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { ApiCalendar } from '@/lib/calendars/useCalendarsApi';
import LocationAutocomplete from '@/components/calendar/events/LocationAutoComplete';

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

type GuestEntry = string | { email: string; permissions?: string[] };

function normalizeGuests(
  guests: GuestEntry[] | undefined,
  guestPermissions: string[],
): Array<string | { email: string; permissions?: string[] }> | undefined {
  if (!guests || guests.length === 0) return undefined;
  const out: Array<string | { email: string; permissions?: string[] }> = [];
  for (const g of guests) {
    if (typeof g === 'string') {
      if (guestPermissions.length) out.push({ email: g, permissions: guestPermissions });
      else out.push(g);
      continue;
    }

    if (g && typeof g === 'object') {
      const email = (g as { email?: unknown }).email;
      if (typeof email !== 'string') continue;
      if (guestPermissions.length) {
        out.push({
          email: String(email),
          permissions:
            Array.isArray((g as { permissions?: unknown }).permissions) &&
            (g as { permissions?: unknown }).permissions !== undefined
              ? ((g as { permissions?: unknown }).permissions as unknown[]).map(String)
              : guestPermissions,
        });
      } else {
        out.push(String(email));
      }
    }
  }
  return out.length ? out : undefined;
}

type Props = {
  initialDate: Date;
  calendars?: ApiCalendar[];
  onClose: () => void;
  // accept full CalendarEvent shape (guests may be strings or objects with permissions)
  onCreate: (event: CalendarEvent) => void;
};

export function EventForm({ initialDate, calendars, onClose, onCreate }: Props) {
  const initialStart = useMemo(() => new Date(initialDate), [initialDate]);
  const initialEnd = useMemo(() => addMinutes(new Date(initialDate), 60), [initialDate]);
  const defaultStart = useMemo(() => startOfDayLocal(initialStart), [initialStart]);
  const defaultEnd = useMemo(() => addDays(startOfDayLocal(initialEnd), 1), [initialEnd]);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(toLocalDateTimeInputValue(defaultStart));
  const [end, setEnd] = useState(toLocalDateTimeInputValue(defaultEnd));
  const [showTime, setShowTime] = useState(false);
  const [allDay, setAllDay] = useState(true);
  const [calendarId, setCalendarId] = useState<string>(calendars?.[0]?.id ?? '');

  const [guests, setGuests] = useState<GuestEntry[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);
  const [location, setLocation] = useState('');
  const [addMeeting, setAddMeeting] = useState(false);

  // Local submit validation error
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Guest permissions (per-guest set applies to all added guests in this compact form)
  const permissionOptions = [
    { key: 'modify', label: 'Modify event', defaultChecked: false },
    { key: 'invite', label: 'Invite others', defaultChecked: true },
    { key: 'seeGuests', label: 'See guest list', defaultChecked: true },
  ] as const;
  const [guestPermissions, setGuestPermissions] = useState<string[]>(() =>
    permissionOptions.filter((p) => p.defaultChecked).map((p) => p.key),
  );

  const router = useRouter();

  function isValidEmail(email: string) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  }

  const validateBeforeSubmit = () => {
    // For timed events ensure end > start
    if (!allDay) {
      const s = new Date(start).getTime();
      const e = new Date(end).getTime();
      if (Number.isNaN(s) || Number.isNaN(e) || e <= s) {
        setSubmitError('End must be after start');
        return false;
      }
    }
    setSubmitError(null);
    return true;
  };

  const submit = () => {
    if (!validateBeforeSubmit()) return;

    // Normalize guests to the API-friendly shape (string or {email, permissions})
    const mappedGuests = normalizeGuests(guests, guestPermissions);

    const payload: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      allDay,
      guests: mappedGuests,
      // compact form: we only have a plain location string and a minimal set of fields
      location: location || undefined,
      notifications: undefined,
      recurrence: null,
      description: undefined,
      busyStatus: 'busy',
      visibility: 'default',
      color: '#0B57D0',
      start: '',
      end: '',
      recurringEventId: undefined,
      originalStartAt: undefined,
      isRecurringInstance: false,
    };

    if (allDay) {
      const startDateStr = start.slice(0, 10); // "YYYY-MM-DD"
      const startDateObj = parseISO(`${startDateStr}T00:00:00`);
      const endDateObj = addDays(startDateObj, 1);

      const endDateStr = format(endDateObj, 'yyyy-MM-dd'); // exclusive endDate

      payload.startDate = startDateStr;
      payload.endDate = endDateStr;

      payload.start = startDateObj.toISOString();
      payload.end = endDateObj.toISOString();
    } else {
      const startObj = new Date(start);
      const endObj = new Date(end);
      payload.start = startObj.toISOString();
      payload.end = endObj.toISOString();
    }

    // transient flag to request meeting generation
    payload.addMeeting = addMeeting || undefined;

    onCreate(payload);
  };

  const addGuest = () => {
    const trimmed = guestInput.trim();
    if (!trimmed) return;
    if (!isValidEmail(trimmed)) {
      setGuestError('Enter a valid email address (e.g. name@example.com)');
      return;
    }
    setGuests((prev) => [...prev, trimmed]);
    setGuestInput('');
    setGuestError(null);
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
    <div className="space-y-3 px-4 py-4 dark:text-[var(--gcal-text),e8eaed]">
      {submitError && <p className="text-sm text-red-600">{submitError}</p>}
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
              className="rounded-full border px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-[var(--color-gray-700)]"
              onClick={onClickAddTime}
            >
              Add time
            </button>
          ) : (
            <label className="flex items-center gap-2 text-sm">
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
            onChange={(e) => {
              setGuestInput(e.target.value);
              if (guestError) setGuestError(null);
            }}
            onKeyDown={onGuestInputKey}
            placeholder="Add guest and press Enter"
          />
        </div>

        {guestError && <p className="text-xs text-red-600">{guestError}</p>}

        {guests.length > 0 && (
          <div className="space-y-1">
            {guests.map((g: GuestEntry, i: number) => (
              <div
                key={`${typeof g === 'string' ? g : g.email}-${i}`}
                className="flex items-center justify-between gap-2 px-1 py-1 hover:bg-gray-100"
              >
                <span className="text-sm text-gray-700">{typeof g === 'string' ? g : g.email}</span>
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

        {/* Guest permissions (compact) */}
        <div className="mt-2 border-t pt-2">
          <div className="mb-2 text-xs text-gray-500">Guest permissions</div>
          <div className="flex gap-3">
            {permissionOptions.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={guestPermissions.includes(key)}
                  onChange={(e) => {
                    setGuestPermissions((prev) =>
                      e.target.checked ? [...prev, key] : prev.filter((x) => x !== key),
                    );
                  }}
                  className="h-4 w-4 rounded accent-[#0B57D0]"
                />
                <span className="text-sm text-gray-700 dark:text-white">{label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="flex items-center gap-2 border-t pt-3">
        <MapPinIcon size={16} />
        <div className="flex-1">
          <LocationAutocomplete
            value={location}
            onChange={(v) => setLocation(v)}
            placeholder="Add location"
          />
        </div>
      </div>

      {/* Calendar selector */}
      {calendars && calendars.length > 1 && (
        <div className="flex items-center gap-2 border-t pt-3">
          <span className="text-xs">Calendar</span>
          <select
            className="flex-1 rounded border px-2 py-1.5 text-sm"
            value={calendarId}
            onChange={(e) => setCalendarId(e.target.value)}
          >
            {calendars.map((cal) => (
              <option key={cal.id} value={cal.id}>
                {cal.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 px-4 py-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={addMeeting}
            onChange={(e) => setAddMeeting(e.target.checked)}
          />
          <span className="text-sm text-gray-700 dark:text-white">Add meeting (Jitsi)</span>
        </label>
      </div>
      <div className="flex items-center justify-end gap-2 px-4 py-3 font-semibold">
        <button
          type="button"
          className="rounded-3xl px-3 py-2 text-sm text-blue-700 hover:bg-blue-100 dark:hover:bg-[var(--color-gray-700)]"
          onClick={onMoreOptions}
        >
          More Options
        </button>
        <button
          type="button"
          className="rounded-3xl bg-[#0B57D0] px-4 py-2 text-sm text-white hover:bg-[#044dc2]"
          onClick={submit}
        >
          Save
        </button>
      </div>
    </div>
  );
}
