'use client';

import { XIcon, MenuIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { EventForm } from '@/components/calendar/events/forms/EventForm';
import { TaskForm } from '@/components/calendar/events/forms/TaskForm';
import { AppointmentForm } from '@/components/calendar/events/forms/AppointmentForm';
import { modeOptions } from '@/constants';
import type { ApiCalendar } from '@/lib/calendars/useCalendarsApi';

type Kind = 'event' | 'task' | 'appointment';

type Props = {
  open: boolean;
  initialDate: Date;
  initialKind?: Kind;
  calendars?: ApiCalendar[];
  onClose: () => void;
  onCreate: (event: CalendarEvent) => void;
};

export function CreateEventModal({
  open,
  initialDate,
  initialKind = 'event',
  calendars,
  onClose,
  onCreate,
}: Props) {
  // Single source of truth — synced from `initialKind` whenever the modal opens.
  // After that, the user can switch tabs inside the modal freely.
  const [mode, setMode] = useState<Kind>(initialKind);

  useEffect(() => {
    if (open) setMode(initialKind);
  }, [open, initialKind]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex w-full items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Create"
    >
      <div className="w-full max-w-md rounded-lg bg-[var(--gcal-bg-app,#F0F4F9)] shadow-lg dark:bg-gray-800">
        {/* Header — tab switcher */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <MenuIcon size={16} className="text-gray-500 dark:text-gray-400" />
            <div
              role="tablist"
              aria-label="Create kind"
              className="inline-flex rounded-lg bg-gray-100 p-1 dark:bg-gray-700"
            >
              {modeOptions.map((option) => {
                const active = mode === option.value;
                return (
                  <button
                    key={option.value}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    className={[
                      'rounded-md px-3 py-1 text-sm font-medium transition-colors',
                      active
                        ? 'bg-white text-[var(--gcal-text,#3c4043)] shadow-sm dark:bg-gray-800 dark:text-gray-100'
                        : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100',
                    ].join(' ')}
                    onClick={() => setMode(option.value as Kind)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            aria-label="Close"
            className="rounded p-1 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body — re-mount on (mode, date) so child form state resets cleanly */}
        {mode === 'event' && (
          <EventForm
            key={`event-${initialDate.toISOString()}`}
            initialDate={initialDate}
            calendars={calendars}
            onClose={onClose}
            onCreate={onCreate}
          />
        )}
        {mode === 'task' && (
          <TaskForm
            key={`task-${initialDate.toISOString()}`}
            initialDate={initialDate}
            onClose={onClose}
            onCreate={onCreate}
          />
        )}
        {mode === 'appointment' && (
          <AppointmentForm
            key={`appointment-${initialDate.toISOString()}`}
            initialDate={initialDate}
            onClose={onClose}
            onCreate={onCreate}
          />
        )}
      </div>
    </div>
  );
}
