import { format } from 'date-fns';

export function DayView(props: {date: Date}) {
  const { date } = props;
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="rounded-lg border bg-white p-4">
      <div className="border-b px-4 py-3">
        <h2 className="text-lg font-semibold">Day</h2>
        <p className="mt-1 text-sm text-gray-600">{format(date, 'EEE, MMM d, yyyy')}</p>
      </div>
      <div className="divide-y">
        {
          hours.map((hour) => {
            const label = hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
            return (
              <div key={hour} className="grid grid-cols-[80px_1fr]">
                <div className="border-r px-3 py-3 text-xs text-gray-500">{label}</div>
                <div className="px-3 py-3">
                  {/* Placeholder for events */}
                  <div className="h-6 rounded bg-gray-50"></div>
                </div>
              </div>
            )
          })
        }
      </div>
    </div>
  );
}
