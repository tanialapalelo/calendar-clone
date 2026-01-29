import { Suspense } from 'react';
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
