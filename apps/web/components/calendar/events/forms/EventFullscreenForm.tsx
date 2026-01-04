'use client';

import { addDays, addMinutes, format, parseISO } from 'date-fns';
import { KeyboardEvent, useEffect, useMemo, useState } from 'react';
import { startOfDayDefaultHour, toLocalDateTimeInputValue } from '@/lib/date';
import {
  BellIcon,
  BriefcaseBusinessIcon,
  MapPinIcon,
  NotebookPenIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import {
  eventFormOption,
  eventVisibilityOptions,
  notificationOption,
  statusOptions,
  unitOfTimeOptions,
} from '@/constants';
import LocationAutocomplete, {
  PlaceSuggestion,
} from '@/components/calendar/events/LocationAutoComplete';

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
  event?: CalendarEvent;
  initialDate: Date;
  onClose: () => void;
  onCreate?: (event: CalendarEvent) => void;
  onSave?: (event: CalendarEvent) => void;
  onDelete?: (id: string) => void;
};

export function EventFullscreenForm({
  event,
  initialDate,
  onClose,
  onCreate,
  onSave,
  onDelete,
}: Props) {
  const initialStart = useMemo(() => new Date(initialDate), [initialDate]);
  const initialEnd = useMemo(() => new Date(initialDate), [initialDate]);

  const [title, setTitle] = useState('');
  const [start, setStart] = useState(toLocalDateTimeInputValue(initialStart));
  const [end, setEnd] = useState(toLocalDateTimeInputValue(initialEnd));
  const [showTime, setShowTime] = useState(false);
  const [allDay, setAllDay] = useState(true);

  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState('');
  const [guestError, setGuestError] = useState<string | null>(null);

  const [location, setLocation] = useState(''); // display name
  const [locationPlace, setLocationPlace] = useState<PlaceSuggestion | null>(null); // optional full place

  const [tab, setTab] = useState('detail');

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState<'busy' | 'free'>('busy');
  const [visibility, setVisibility] = useState<'default' | 'public' | 'private'>('default');

  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      console.log('load event into form', event);
      setTitle(event.title ?? '');
      setStart(toLocalDateTimeInputValue(new Date(event.start)));
      setEnd(toLocalDateTimeInputValue(new Date(event.end)));
      setAllDay(event.allDay);
      setShowTime(!event.allDay);
      setGuests((event as any).guests ?? []);
      setGuestInput('');
      setGuestError(null);
      // if the stored location is JSON, try to parse and set place
      try {
        const parsed = typeof event.location === 'string' ? JSON.parse(event.location) : null;
        if (parsed && parsed.display_name) {
          setLocation(parsed.display_name ?? '');
          setLocationPlace(parsed);
        } else {
          setLocationPlace(null);
        }
      } catch {
        setLocationPlace(null);
      }
      setNotifications(event.notifications ?? []);
      setDescription(event.description ?? '');
      setBusy(event.busyStatus ?? 'busy');
      setVisibility(event.visibility ?? 'default');
      setSubmitError(null);
    } else {
      // reset to initial
      const s = startOfDayDefaultHour(initialStart);
      const e = startOfDayDefaultHour(initialEnd);
      setStart(toLocalDateTimeInputValue(s));
      setEnd(toLocalDateTimeInputValue(e));
      setAllDay(true);
      setShowTime(false);
      setGuests([]);
      setGuestInput('');
      setGuestError(null);
      setLocation('');
      setLocationPlace(null);
      setNotifications([
        {
          id: crypto.randomUUID(),
          method: 'notification',
          amount: 30,
          unit: 'minutes',
        },
      ]);
      setDescription('');
      setBusy('busy');
      setVisibility('default');
      setTitle('');
      setSubmitError(null);
    }
  }, [event, initialDate]);

  // simple email validator
  function isValidEmail(email: string) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email.trim());
  }

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
      const s = startOfDayDefaultHour(new Date(start));
      const e = startOfDayDefaultHour(new Date(start));
      setStart(toLocalDateTimeInputValue(s));
      setEnd(toLocalDateTimeInputValue(e));
      setShowTime(false);
    } else {
      setShowTime(true);
      setStart((prev) => ensureDateTimeInputValueFrom(prev, 9));
      setEnd((prev) => ensureDateTimeInputValueFrom(prev, 10));
    }
  };

  // Notifications
  const addNotification = () => {
    const id = crypto.randomUUID();
    const defaultUnit: NotificationItem['unit'] = 'minutes';
    const defaultMethod = notificationOption[0]?.value ?? 'notification';
    setNotifications((prev) => [
      ...prev,
      { id, method: defaultMethod, amount: 30, unit: defaultUnit },
    ]);
  };

  const updateNotification = (id: string, updates: Partial<NotificationItem>) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, ...updates } : n)));
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // construct selection for repetition options according to date chosen
  const repetitionOptions = () => {
    const options = [];
    const startDate = new Date(start);
    const dayOfWeek = format(startDate, 'EEEE'); // e.g., 'Monday'
    const dayOfMonth = startDate.getDate(); // e.g., 15
    options.push('Daily');
    options.push(`Weekly on ${dayOfWeek}`);
    options.push(`Annually on ${dayOfMonth} ${format(startDate, 'MMMM')}`);
    options.push('Every weekday (Monday to Friday)');
    return options;
  };
  const validateBeforeSubmit = () => {
    // ensure end > start
    const s = new Date(start).getTime();
    const e = new Date(end).getTime();
    if (e <= s && !allDay) {
      setSubmitError('End must be after start');
      return false;
    }
    setSubmitError(null);
    return true;
  };

  const submit = () => {
    if (!validateBeforeSubmit()) return;

    let startDate: Date;
    let endDate: Date;
    if (allDay) {
      startDate = startOfDayDefaultHour(new Date(start));
      endDate = addDays(startOfDayDefaultHour(new Date(end)), 1);
    } else {
      startDate = new Date(start);
      endDate = new Date(end);
    }

    console.log('submit', allDay, startDate, endDate);

    const payload: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      allDay,
      guests: guests.length ? guests : undefined,
      // store structured location if available, otherwise the string
      location: locationPlace ? JSON.stringify(locationPlace) : location || undefined,
      notifications: notifications.length ? notifications : undefined,
      description: description || undefined,
      busyStatus: busy || undefined,
      visibility: visibility || undefined,
    };

    console.log('payload', payload);
    if (event) {
      // existing event, call onSave
      onSave?.({ ...payload, id: event.id });
    } else {
      // new event, call onCreate
      onCreate?.(payload);
    }
  };
  return (
    <div className="space-y-3 px-4 py-4">
      <button onClick={onClose}>
        <XIcon size={16} />
      </button>
      <div>
        <input
          className="w-full rounded border px-3 py-2 text-sm"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add title"
          autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
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

        <div className="col-span-2 flex gap-2">
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
          {/*  selections for repetition event */}
          <div>
            <select className="rounded border p-3 text-sm text-gray-700 hover:bg-gray-100">
              <option value="">Does not repeat</option>
              {repetitionOptions().map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white p-3 shadow">
        <div className="border-b">
          {eventFormOption.map((option) => (
            <button
              key={option.value}
              type="button"
              className={[
                'px-3 py-1 text-sm font-medium',
                tab === option.value
                  ? 'border-b-2 border-b-[#0B57D0] text-[#0B57D0]'
                  : 'text-gray-600',
              ].join(' ')}
              onClick={() => setTab(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        {tab === 'detail' && (
          <>
            {/* Location */}
            <div className="flex items-center gap-2 pt-3">
              <MapPinIcon size={16} />
              <div className="flex-1">
                <LocationAutocomplete
                  value={location}
                  onChange={(v) => {
                    setLocation(v);
                    // clear place details when user types
                    setLocationPlace(null);
                  }}
                  onSelect={(place) => {
                    setLocation(place.display_name);
                    setLocationPlace(place);
                  }}
                  placeholder="Add location"
                />
                {locationPlace && (
                  <div className="mt-1 text-xs text-gray-500">
                    Selected: {locationPlace.display_name}
                    {locationPlace.lat && locationPlace.lon && (
                      <span className="ml-2">
                        ({locationPlace.lat.slice(0, 7)}, {locationPlace.lon.slice(0, 7)})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/*  Notification */}
            <div className="mt-3 flex items-start gap-2">
              <BellIcon size={16} />
              <div className="flex-1">
                {notifications.map((n) => (
                  <div key={n.id} className="mb-2 flex items-center gap-2">
                    {/* selection */}
                    <select
                      className="rounded-md bg-gray-200 p-3 text-sm"
                      onChange={(e) =>
                        updateNotification(n.id, {
                          method: e.target.value,
                        })
                      }
                      value={n.method}
                    >
                      {notificationOption.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* time to ring */}
                    <input
                      type="number"
                      min={1}
                      value={n.amount}
                      max={60}
                      className="w-16 rounded-md bg-gray-200 p-3 text-sm"
                      onChange={(e) => updateNotification(n.id, { amount: Number(e.target.value) })}
                    />

                    {/* unit of time (minutes, etc) */}
                    <select
                      value={n.unit}
                      onChange={(e) =>
                        updateNotification(n.id, {
                          unit: e.target.value as NotificationItem['unit'],
                        })
                      }
                      className="rounded bg-gray-200 p-3 text-sm"
                    >
                      {unitOfTimeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    {/* remove notification */}
                    <button onClick={() => removeNotification(n.id)}>
                      <XIcon
                        size={25}
                        className="rounded-full p-1 text-gray-600 hover:bg-gray-200"
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <button
              className="my-1 ml-6 rounded-full p-2 text-sm text-[#0B57D0] hover:bg-blue-100"
              onClick={addNotification}
            >
              Add notification
            </button>

            {/* Status + Visibility */}
            <div className="flex items-center gap-2 pt-3">
              <BriefcaseBusinessIcon size={16} />
              <div className="flex-1">
                {/* Status */}
                <select
                  className="rounded-md bg-gray-200 p-3 text-sm"
                  onChange={(e) => setBusy(e.target.value as 'busy' | 'free')}
                  value={busy}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {/* Visibility */}
                <select
                  className="ml-3 rounded-md bg-gray-200 p-3 text-sm"
                  onChange={(e) =>
                    setVisibility(e.target.value as 'default' | 'public' | 'private')
                  }
                  value={visibility}
                >
                  {eventVisibilityOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Description */}
            <div className="flex items-center gap-2 pt-3">
              <NotebookPenIcon size={16} />
              <div className="flex-1">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Add description"
                  className="min-h-[120px] w-full rounded border p-3 text-sm"
                />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Guests */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
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
              <button
                type="button"
                className="rounded px-3 py-1 text-sm hover:bg-gray-100"
                onClick={addGuest}
              >
                Add
              </button>
            </div>

            {guestError && <div className="text-sm text-red-600">{guestError}</div>}

            {(guests ?? []).length > 0 && (
              <div className="space-y-1">
                {(guests ?? []).map((g, i) => (
                  <div
                    key={`${g}-${i}`}
                    className="flex items-center justify-between gap-2 px-1 py-1 hover:bg-gray-100"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-700">{g}</span>
                    </div>
                    <button
                      type="button"
                      className="rounded-full px-2 py-1 text-sm hover:bg-gray-200"
                      onClick={() =>
                        setGuests((prev) => (prev ?? []).filter((_, idx) => idx !== i))
                      }
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* right column: guest permissions, simple preview */}
        <div>
          <div className="mb-2 text-sm font-semibold">Guest permissions</div>
          <label className="flex items-center gap-2">
            <input type="checkbox" />
            <span className="text-sm">Modify event</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">Invite others</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" defaultChecked />
            <span className="text-sm">See guest list</span>
          </label>
        </div>
      </div>

      {/* submit error */}
      {submitError && <div className="text-sm text-red-600">{submitError}</div>}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <button
          type="button"
          className="rounded-3xl bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#044dc2]"
          onClick={submit}
        >
          Save
        </button>
        {event && (
          <button
            type="button"
            className="rounded-3xl bg-[#0B57D0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#044dc2]"
            onClick={() => onDelete?.(event.id)}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
