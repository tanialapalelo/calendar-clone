import { Suspense } from 'react';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import NewEventClient from './NewEventClient';

export default function NewEventPage() {
  return (
    <div className="p-6">
      <Suspense fallback={null}>
        <NewEventClient />
      </Suspense>
    </div>
  );
}
