'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import {
  apiEventToCalendarEvent,
  deleteEvent,
  getEvent,
  normalizeRuleOnly,
  updateEvent,
} from '@/lib/api/events';
import { RecurrenceScopeModal } from '@/components/calendar/events/RecurrenceScopeModal';
import type { RecurrenceScope } from '@/lib/api/events';

function getMasterIdFromInstanceId(id: string): string | null {
  const at = id.indexOf('@');
  if (at <= 0) return null;
  const iso = id.slice(at + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return id.slice(0, at);
}

function getInstanceId(event: CalendarEvent): string | null {
  if (event.id.includes('@')) return event.id;
  if (event.recurringEventId && event.originalStartAt) {
    return `${event.recurringEventId}@${event.originalStartAt}`;
  }
  return null;
}

function getInstanceIdFromRoute(masterId: string, occ: string | null): string | null {
  if (!occ) return null;
  const d = new Date(occ);
  if (Number.isNaN(d.getTime())) return null;
  return `${masterId}@${occ}`;
}

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const id = String(params?.id ?? '');
  const occ = searchParams.get('occ'); // ISO string or null

  const [ev, setEv] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<
    { type: 'save'; payload: CalendarEvent } | { type: 'delete'; payload: CalendarEvent } | null
  >(null);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      setLoading(true);

      // If occ is present, fetch the synthetic occurrence by using instance id format
      const fetchId = occ ? `${id}@${occ}` : id;

      const res = await getEvent(fetchId);

      if (!res.ok) {
        if (res.status === 401) router.replace('/login');
        else console.error('getEvent failed', res.status, res.error);
        setLoading(false);
        return;
      }

      setEv(apiEventToCalendarEvent(res.data));
      setLoading(false);
    };

    void run();
  }, [id, occ, router]);

  if (loading || !ev) return <div className="p-6">Loading…</div>;

  const handleSave = async (updated: CalendarEvent, scope?: RecurrenceScope) => {
    const isInstance = updated.isRecurringInstance && updated.recurringEventId;
    const masterIdFromRoute = id;
    const masterId =
      updated.recurringEventId ?? getMasterIdFromInstanceId(updated.id) ?? updated.id;
    const instanceId =
      getInstanceId(updated) ?? getInstanceIdFromRoute(masterIdFromRoute, occ) ?? updated.id;
    const targetId =
      isInstance && scope && scope !== 'all'
        ? instanceId
        : isInstance
          ? masterIdFromRoute
          : updated.id;

    const res = await updateEvent(
      targetId,
      {
        title: updated.title,
        startAt: updated.start,
        endAt: updated.end,
        allDay: !!updated.allDay,
        startDate: updated.allDay ? (updated.startDate ?? undefined) : undefined,
        endDate: updated.allDay ? (updated.endDate ?? undefined) : undefined,
        description: updated.description ?? '',
        location: updated.location ?? '',
        color: updated.color ?? null,
        recurrenceRule: normalizeRuleOnly(updated.recurrence ?? null),
        guests: updated.guests ?? [],
        notifications: updated.notifications ?? [],
        visibility: updated.visibility ?? 'default',
        busyStatus: updated.busyStatus ?? 'busy',
      },
      scope,
    );

    if (!res.ok) {
      if (res.status === 401) router.replace('/login');
      else console.error('updateEvent failed', res.status, res.error);
      return;
    }

    router.push('/');
  };

  const handleDelete = async (eventToDelete: CalendarEvent, scope?: RecurrenceScope) => {
    const isInstance = eventToDelete.isRecurringInstance && eventToDelete.recurringEventId;
    const masterIdFromRoute = id;
    const masterId =
      eventToDelete.recurringEventId ??
      getMasterIdFromInstanceId(eventToDelete.id) ??
      eventToDelete.id;
    const instanceId =
      getInstanceId(eventToDelete) ??
      getInstanceIdFromRoute(masterIdFromRoute, occ) ??
      eventToDelete.id;
    const targetId =
      isInstance && scope && scope !== 'all'
        ? instanceId
        : isInstance
          ? masterIdFromRoute
          : eventToDelete.id;

    const res = await deleteEvent(targetId, scope);

    if (!res.ok) {
      if (res.status === 401) router.replace('/login');
      else console.error('deleteEvent failed', res.status, res.error);
      return;
    }

    router.push('/');
  };

  return (
    <div className="p-6">
      <EventFullscreenForm
        key={ev.id}
        event={ev}
        initialDate={new Date(ev.start)}
        onClose={() => router.push('/')}
        onSave={(e) => {
          if (e.isRecurringInstance) {
            setPendingAction({ type: 'save', payload: e });
            setScopeOpen(true);
            return;
          }
          void handleSave(e);
        }}
        onDelete={(eventId) => {
          if (!ev) return;
          if (ev.isRecurringInstance) {
            setPendingAction({ type: 'delete', payload: ev });
            setScopeOpen(true);
            return;
          }

          if (confirm('Delete this event?')) {
            void handleDelete({ ...ev, id: eventId });
          }
        }}
      />

      <RecurrenceScopeModal
        key={`${pendingAction?.payload?.id ?? 'none'}-${pendingAction?.type ?? 'none'}-${scopeOpen ? 'open' : 'closed'}`}
        open={scopeOpen}
        title={
          pendingAction?.type === 'delete' ? 'Delete recurring event' : 'Update recurring event'
        }
        defaultScope="this"
        onCancel={() => {
          setScopeOpen(false);
          setPendingAction(null);
        }}
        onConfirm={(scope) => {
          if (!pendingAction) return;

          if (pendingAction.type === 'save') {
            void handleSave(pendingAction.payload, scope);
          } else {
            void handleDelete(pendingAction.payload, scope);
          }

          setScopeOpen(false);
          setPendingAction(null);
        }}
      />
    </div>
  );
}
