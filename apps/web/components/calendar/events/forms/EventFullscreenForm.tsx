'use client';

import { addDays, format, isValid, parseISO, subDays } from 'date-fns';
import { KeyboardEvent, useMemo, useState } from 'react';
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
import RecurrencePicker from '@/components/calendar/events/RecurrencePicker';
import ColorPicker from '@/components/calendar/events/ColorPicker';

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

function dateOnlyToInputValue(dateOnly: string) {
  return `${dateOnly}T00:00`;
}

function displayEndDateFromExclusive(endDateExclusive: string) {
  const d = parseISO(`${endDateExclusive}T00:00:00`);
  if (!isValid(d)) return endDateExclusive;
  const prev = subDays(d, 1);
  return format(prev, 'yyyy-MM-dd');
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
  const initialValues = useMemo(() => {
    if (event) {
      const startDateOnly = event.startDate ?? undefined;
      const endDateOnly = event.endDate ?? undefined;
      const allDayStart = startDateOnly ? dateOnlyToInputValue(startDateOnly) : undefined;
      const allDayEnd = endDateOnly
        ? dateOnlyToInputValue(displayEndDateFromExclusive(endDateOnly))
        : undefined;

      const fallbackStart = toLocalDateTimeInputValue(parseISO(event.start));
      const fallbackEnd = toLocalDateTimeInputValue(parseISO(event.end));

      let locationText = '';
      let locationPlaceValue: PlaceSuggestion | null = null;

      try {
        const parsed = typeof event.location === 'string' ? JSON.parse(event.location) : null;
        if (parsed && parsed.display_name) {
          locationText = parsed.display_name ?? '';
          locationPlaceValue = parsed;
        }
      } catch {
        // fall back to plain string below
      }

      if (!locationText) locationText = event.location ?? '';

      return {
        title: event.title ?? '',
        start: event.allDay ? (allDayStart ?? fallbackStart) : fallbackStart,
        end: event.allDay ? (allDayEnd ?? fallbackEnd) : fallbackEnd,
        allDay: event.allDay,
        showTime: !event.allDay,
        guests: event.guests ?? [],
        guestInput: '',
        guestError: null as string | null,
        location: locationText,
        locationPlace: locationPlaceValue,
        notifications: event.notifications ?? [],
        description: event.description ?? '',
        busy: event.busyStatus ?? 'busy',
        visibility: event.visibility ?? 'default',
        recurrence: { rrule: event.recurrence ?? null } as RecurrenceValue,
        color: event.color ?? '#0B57D0',
      };
    }

    const s = startOfDayDefaultHour(new Date(initialDate));
    const e = startOfDayDefaultHour(new Date(initialDate));

    return {
      title: '',
      start: toLocalDateTimeInputValue(s),
      end: toLocalDateTimeInputValue(e),
      allDay: true,
      showTime: false,
      guests: [] as string[],
      guestInput: '',
      guestError: null as string | null,
      location: '',
      locationPlace: null as PlaceSuggestion | null,
      notifications: [
        { id: crypto.randomUUID(), method: 'notification', amount: 30, unit: 'minutes' },
      ] as NotificationItem[],
      description: '',
      busy: 'busy' as 'busy' | 'free',
      visibility: 'default' as 'default' | 'public' | 'private',
      recurrence: { rrule: null } as RecurrenceValue,
      color: '#0B57D0',
    };
  }, [event, initialDate]);

  const [title, setTitle] = useState(initialValues.title);
  const [start, setStart] = useState(initialValues.start);
  const [end, setEnd] = useState(initialValues.end);
  const [showTime, setShowTime] = useState(initialValues.showTime);
  const [allDay, setAllDay] = useState(initialValues.allDay);

  const [guests, setGuests] = useState<string[]>(initialValues.guests);
  const [guestInput, setGuestInput] = useState(initialValues.guestInput);
  const [guestError, setGuestError] = useState<string | null>(initialValues.guestError);

  const [location, setLocation] = useState(initialValues.location); // display name
  const [locationPlace, setLocationPlace] = useState<PlaceSuggestion | null>(
    initialValues.locationPlace,
  ); // optional full place

  const [tab, setTab] = useState('detail');

  const [notifications, setNotifications] = useState<NotificationItem[]>(
    initialValues.notifications,
  );

  const [description, setDescription] = useState(initialValues.description);
  const [busy, setBusy] = useState<'busy' | 'free'>(initialValues.busy);
  const [visibility, setVisibility] = useState<'default' | 'public' | 'private'>(
    initialValues.visibility,
  );
  const [recurrence, setRecurrence] = useState<RecurrenceValue>(initialValues.recurrence);
  const [color, setColor] = useState(initialValues.color);

  const [submitError, setSubmitError] = useState<string | null>(null);

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
      const s = startOfDayDefaultHour(parseISO(start));
      const e = startOfDayDefaultHour(parseISO(start));
      setStart(toLocalDateTimeInputValue(s));
      setEnd(toLocalDateTimeInputValue(e));
      setShowTime(false);
    } else {
      setShowTime(true);
      setStart((prev) => ensureDateTimeInputValueFrom(prev, 9));
      setEnd((prev) => ensureDateTimeInputValueFrom(prev, 10));
    }
  };

  // Notifications handlers...
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
  const removeNotification = (id: string) =>
    setNotifications((prev) => prev.filter((n) => n.id !== id));

  const validateBeforeSubmit = () => {
    const s = parseISO(start).getTime();
    const e = parseISO(end).getTime();
    if (e <= s && !allDay) {
      setSubmitError('End must be after start');
      return false;
    }
    setSubmitError(null);
    return true;
  };

  const submit = () => {
    if (!validateBeforeSubmit()) return;

    const payload: CalendarEvent = {
      id: crypto.randomUUID(),
      title,
      allDay,
      guests: guests.length ? guests : undefined,
      location: locationPlace ? JSON.stringify(locationPlace) : location || undefined,
      notifications: notifications.length ? notifications : undefined,
      recurrence: recurrence?.rrule ?? null,
      description: description || undefined,
      busyStatus: busy || undefined,
      visibility: visibility || undefined,
      color: color || '#0B57D0',
      start: '',
      end: '',
      recurringEventId: event?.recurringEventId,
      originalStartAt: event?.originalStartAt,
      isRecurringInstance: event?.isRecurringInstance ?? false,
    };

    if (allDay) {
      const startDateStr = start.slice(0, 10); // "YYYY-MM-DD"
      const startDateObj = parseISO(`${startDateStr}T00:00:00`);
      const endDateObj = addDays(startDateObj, 1);

      const endDateStr = format(endDateObj, 'yyyy-MM-dd'); // exclusive endDate

      payload.startDate = startDateStr;
      payload.endDate = endDateStr;

      // Keep ISO instants for backward compatibility (optional)
      payload.start = startDateObj.toISOString();
      payload.end = endDateObj.toISOString();
    } else {
      const startObj = new Date(start);
      const endObj = new Date(end);
      payload.start = startObj.toISOString();
      payload.end = endObj.toISOString();
    }

    if (event) onSave?.({ ...payload, id: event.id });
    else onCreate?.(payload);
  };

  const recurrencePickerStartDate = (() => {
    try {
      return parseISO(start);
    } catch {
      return undefined;
    }
  })();

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

          <div>
            <RecurrencePicker
              value={recurrence}
              onChange={setRecurrence}
              startDate={recurrencePickerStartDate}
            />
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
            {/* Location, Notifications, Color, Status, Description, Guests */}
            <div className="flex items-center gap-2 pt-3">
              <MapPinIcon size={16} />
              <div className="flex-1">
                <LocationAutocomplete
                  value={location}
                  onChange={(v) => {
                    setLocation(v);
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

            <div className="mt-3 flex items-start gap-2">
              <BellIcon size={16} />
              <div className="flex-1">
                {notifications.map((n) => (
                  <div key={n.id} className="mb-2 flex items-center gap-2">
                    <select
                      className="rounded-md bg-gray-100 p-3 text-sm hover:bg-gray-200"
                      onChange={(e) => updateNotification(n.id, { method: e.target.value })}
                      value={n.method}
                    >
                      {notificationOption.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="number"
                      min={1}
                      value={n.amount}
                      max={60}
                      className="w-16 rounded-md bg-gray-100 p-3 text-sm hover:bg-gray-200"
                      onChange={(e) => updateNotification(n.id, { amount: Number(e.target.value) })}
                    />

                    <select
                      value={n.unit}
                      onChange={(e) =>
                        updateNotification(n.id, {
                          unit: e.target.value as NotificationItem['unit'],
                        })
                      }
                      className="rounded bg-gray-100 p-3 text-sm hover:bg-gray-200"
                    >
                      {unitOfTimeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>

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

            <div className="flex items-center gap-2">
              <div className="w-5" />
              <div className="flex-1">
                <ColorPicker value={color} onChange={setColor} />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3">
              <BriefcaseBusinessIcon size={16} />
              <div className="flex-1">
                <select
                  className="rounded-md bg-gray-100 p-3 text-sm hover:bg-gray-200"
                  onChange={(e) => setBusy(e.target.value as 'busy' | 'free')}
                  value={busy}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <select
                  className="ml-3 rounded-md bg-gray-100 p-3 text-sm hover:bg-gray-200"
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

      {submitError && <div className="text-sm text-red-600">{submitError}</div>}

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

export default EventFullscreenForm;
