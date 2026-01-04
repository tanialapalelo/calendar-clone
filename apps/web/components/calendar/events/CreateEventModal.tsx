'use client';

import { XIcon, MenuIcon } from 'lucide-react';
import { useState } from 'react';
import { EventForm } from '@/components/calendar/events/forms/EventForm';
import { TaskForm } from '@/components/calendar/events/forms/TaskForm';
import { modeOptions } from '@/constants';
import { AppointmentForm } from '@/components/calendar/events/forms/AppointmentForm';

type Props = {
  open: boolean;
  initialDate: Date;
  onClose: () => void;
  onCreate: (event: CalendarEvent) => void;
};

export function CreateEventModal({ open, initialDate, onClose, onCreate }: Props) {
  const [mode, setMode] = useState('event');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex w-full items-center justify-center bg-black/40 p-4">
      <div className="max-w-md rounded-lg bg-[#F0F4F9] shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <MenuIcon size={16} />
            <div className="inline-flex rounded-lg bg-gray-100 p-1">
              {modeOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={[
                    'rounded-md px-3 py-1 text-sm font-medium',
                    mode === option.value ? 'bg-white shadow-sm' : 'text-gray-600',
                  ].join(' ')}
                  onClick={() => setMode(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            className="rounded px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
            onClick={onClose}
          >
            <XIcon size={16} />
          </button>
        </div>

        {/* Body */}
        {mode === 'event' ? (
          <EventForm initialDate={initialDate} onClose={onClose} onCreate={onCreate} />
        ) : mode === 'task' ? (
          <TaskForm initialDate={initialDate} onClose={onClose} onCreate={onCreate} />
        ) : (
          <AppointmentForm initialDate={initialDate} onClose={onClose} onCreate={onCreate} />
        )}
      </div>
    </div>
  );
}
