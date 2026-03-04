import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, addMilliseconds } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Prisma } from '@prisma/client';
import { RRule, rrulestr } from 'rrule';

import { CalendarsService } from '../calendars/calendars.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { stripUntil, withUntil, withUntilFloating } from './rrule-until';

type EventInstance = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  startAt: Date;
  endAt: Date;
  startDate: Date | null;
  endDate: Date | null;
  timeZone: string | null;
  color: string | null;
  guests: unknown | null;
  notifications: unknown | null;
  visibility: string | null;
  busyStatus: string | null;
  createdAt: Date;
  updatedAt: Date;

  recurrenceRule?: string | null;
  recurrenceTimeZone?: string | null;

  recurringEventId: string | null;
  originalStartAt: string | null; // ISO UTC
  isRecurringInstance: boolean;
};

export function normalizeRuleOnly(rule: string | null | undefined) {
  if (!rule) return null;

  const trimmed = rule.trim();
  if (!trimmed) return null;

  const lines = trimmed.split(/\r?\n/).map((l) => l.trim());
  const rruleLine = lines.find((l) => l.toUpperCase().startsWith('RRULE:'));
  const candidate = rruleLine ?? trimmed;

  return candidate.toUpperCase().startsWith('RRULE:')
    ? candidate.slice('RRULE:'.length)
    : candidate;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function formatFloatingDtstart(d: Date) {
  // DTSTART:YYYYMMDDTHHMMSS (floating; no Z)
  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const hh = pad2(d.getHours());
  const mm = pad2(d.getMinutes());
  const ss = pad2(d.getSeconds());
  return `DTSTART:${y}${m}${day}T${hh}${mm}${ss}`;
}

function parseDateOnly(dateStr: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) throw new Error('Invalid date-only string');
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(Date.UTC(y, mo, d, 0, 0, 0, 0));
}

function naiveFromDateColumn(dateCol: Date): Date {
  // @db.Date -> use UTC Y/M/D, but return naive local Date (no tz)
  return new Date(
    dateCol.getUTCFullYear(),
    dateCol.getUTCMonth(),
    dateCol.getUTCDate(),
    0,
    0,
    0,
    0,
  );
}

function dateOnlyFromInstantInTz(instant: Date, tz: string): Date {
  const z = toZonedTime(instant, tz);
  return new Date(
    Date.UTC(z.getFullYear(), z.getMonth(), z.getDate(), 0, 0, 0, 0),
  );
}

function ensureEndAfterStartDateExclusive(
  startDate: Date,
  endDate: Date | null,
): Date {
  if (!endDate) return addDays(startDate, 1);
  if (endDate.getTime() <= startDate.getTime()) return addDays(startDate, 1);
  return endDate;
}

function buildFloatingRule(ruleOnly: string, dtstartNaive: Date): RRule {
  const s = `${formatFloatingDtstart(dtstartNaive)}\nRRULE:${ruleOnly}`;
  return rrulestr(s) as RRule;
}

function toLocalNaiveInTz(instantUtc: Date, tz: string): Date {
  const z = toZonedTime(instantUtc, tz);
  return new Date(
    z.getFullYear(),
    z.getMonth(),
    z.getDate(),
    z.getHours(),
    z.getMinutes(),
    z.getSeconds(),
    z.getMilliseconds(),
  );
}

function localMidnightNaiveFromUtcInstant(utcInstant: Date, tz: string): Date {
  const z = toZonedTime(utcInstant, tz);
  return new Date(z.getFullYear(), z.getMonth(), z.getDate(), 0, 0, 0, 0);
}

function generateAfterExclusive(args: {
  rule: RRule;
  fromNaive: Date;
  toNaive: Date;
  max: number;
}) {
  const { rule, fromNaive, toNaive, max } = args;

  const out: Date[] = [];
  let cursor = addMilliseconds(fromNaive, -1);

  while (out.length < max) {
    const next = rule.after(cursor, false); // exclusive
    if (!next) break;
    if (next >= toNaive) break;
    if (next.getTime() <= cursor.getTime()) break;
    out.push(next);
    cursor = next;
  }

  return out;
}

function parseInstanceId(
  id: string,
): { masterId: string; originalStartAt: Date } | null {
  const at = id.indexOf('@');
  if (at < 0) return null;
  const masterId = id.slice(0, at);
  const iso = id.slice(at + 1);
  const d = new Date(iso);
  if (!masterId || Number.isNaN(d.getTime())) return null;
  return { masterId, originalStartAt: d };
}

function exceptionKey(eventId: string, originalStartAt: Date | string) {
  const iso =
    typeof originalStartAt === 'string'
      ? originalStartAt
      : originalStartAt.toISOString();
  return `${eventId}|${iso}`;
}

function applyExceptionToInstance(
  instance: EventInstance,
  ex: {
    cancelled: boolean;
    title: string | null;
    description: string | null;
    location: string | null;
    allDay: boolean | null;
    startAt: Date | null;
    endAt: Date | null;
    startDate: Date | null;
    endDate: Date | null;
    color: string | null;
    timeZone: string | null;
    guests: unknown | null;
    notifications: unknown | null;
    visibility: string | null;
    busyStatus: string | null;
  },
  tz: string,
): EventInstance | null {
  if (ex.cancelled) return null;

  const nextAllDay = ex.allDay ?? instance.allDay;

  let nextStartAt = ex.startAt ?? instance.startAt;
  let nextEndAt = ex.endAt ?? instance.endAt;
  let nextStartDate = ex.startDate ?? instance.startDate;
  let nextEndDate = ex.endDate ?? instance.endDate;

  if (ex.allDay === false) {
    nextStartDate = null;
    nextEndDate = null;
  }

  if (nextAllDay) {
    if (!nextStartDate)
      nextStartDate = dateOnlyFromInstantInTz(nextStartAt, tz);
    nextEndDate = ensureEndAfterStartDateExclusive(
      nextStartDate,
      nextEndDate ?? dateOnlyFromInstantInTz(nextEndAt, tz),
    );

    if (ex.startDate || ex.endDate || ex.allDay === true) {
      nextStartAt = fromZonedTime(naiveFromDateColumn(nextStartDate), tz);
      nextEndAt = fromZonedTime(naiveFromDateColumn(nextEndDate), tz);
    }
  } else {
    nextStartDate = null;
    nextEndDate = null;
  }

  return {
    ...instance,
    title: ex.title ?? instance.title,
    description: ex.description ?? instance.description,
    location: ex.location ?? instance.location,
    allDay: nextAllDay,
    startAt: nextStartAt,
    endAt: nextEndAt,
    startDate: nextStartDate,
    endDate: nextEndDate,
    timeZone: ex.timeZone ?? instance.timeZone,
    color: ex.color ?? instance.color,
    guests: ex.guests ?? instance.guests,
    notifications: ex.notifications ?? instance.notifications,
    visibility: ex.visibility ?? instance.visibility,
    busyStatus: ex.busyStatus ?? instance.busyStatus,
  };
}

type RecurrenceScope = 'this' | 'following' | 'all';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: CalendarsService,
  ) {}

  async listForUser(
    userId: string,
    from: Date,
    to: Date,
  ): Promise<EventInstance[]> {
    const events = await this.prisma.event.findMany({
      where: {
        calendar: { ownerId: userId },
        OR: [
          { recurrenceRule: { not: null } },
          { AND: [{ endAt: { gt: from } }, { startAt: { lt: to } }] },
        ],
      },
      orderBy: { startAt: 'asc' },
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        color: true,
        recurrenceRule: true,
        recurrenceTimeZone: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const recurringIds = events
      .filter((ev) => !!ev.recurrenceRule)
      .map((ev) => ev.id);

    const exceptions = recurringIds.length
      ? await this.prisma.eventRecurrenceException.findMany({
          where: {
            eventId: { in: recurringIds },
            originalStartAt: { gte: from, lt: to },
          },
          select: {
            eventId: true,
            originalStartAt: true,
            cancelled: true,
            title: true,
            description: true,
            location: true,
            allDay: true,
            startAt: true,
            endAt: true,
            startDate: true,
            endDate: true,
            color: true,
            timeZone: true,
            guests: true,
            notifications: true,
            visibility: true,
            busyStatus: true,
          },
        })
      : [];

    const exceptionMap = new Map<string, (typeof exceptions)[number]>();
    for (const ex of exceptions) {
      exceptionMap.set(exceptionKey(ex.eventId, ex.originalStartAt), ex);
    }

    const out: EventInstance[] = [];
    const MAX_OCCURRENCES = 2000;

    for (const ev of events) {
      const hasRecurrence = !!ev.recurrenceRule;
      const tz = ev.recurrenceTimeZone ?? ev.timeZone ?? 'UTC';

      if (!hasRecurrence) {
        // normalize non-recurring all-day from date columns if present
        if (ev.allDay && ev.startDate && ev.endDate) {
          const startNaive = naiveFromDateColumn(ev.startDate);
          const endNaive = naiveFromDateColumn(ev.endDate);
          const startAt = fromZonedTime(startNaive, tz);
          const endAt = fromZonedTime(endNaive, tz);

          out.push({
            id: ev.id,
            calendarId: ev.calendarId,
            title: ev.title,
            description: ev.description,
            location: ev.location,
            allDay: true,
            startAt,
            endAt,
            startDate: ev.startDate,
            endDate: ev.endDate,
            timeZone: ev.timeZone,
            color: ev.color,
            guests: ev.guests,
            notifications: ev.notifications,
            visibility: ev.visibility,
            busyStatus: ev.busyStatus,
            recurrenceRule: null,
            recurrenceTimeZone: ev.recurrenceTimeZone,
            createdAt: ev.createdAt,
            updatedAt: ev.updatedAt,
            recurringEventId: null,
            originalStartAt: null,
            isRecurringInstance: false,
          });
          continue;
        }

        out.push({
          id: ev.id,
          calendarId: ev.calendarId,
          title: ev.title,
          description: ev.description,
          location: ev.location,
          allDay: ev.allDay,
          startAt: ev.startAt,
          endAt: ev.endAt,
          startDate: ev.startDate,
          endDate: ev.endDate,
          timeZone: ev.timeZone,
          color: ev.color,
          guests: ev.guests,
          notifications: ev.notifications,
          visibility: ev.visibility,
          busyStatus: ev.busyStatus,
          recurrenceRule: ev.recurrenceRule,
          recurrenceTimeZone: ev.recurrenceTimeZone,
          createdAt: ev.createdAt,
          updatedAt: ev.updatedAt,
          recurringEventId: null,
          originalStartAt: null,
          isRecurringInstance: false,
        });
        continue;
      }

      try {
        const ruleOnly = ev.recurrenceRule!;
        const durationMs = ev.endAt.getTime() - ev.startAt.getTime();

        if (ev.allDay) {
          // date-only source of truth
          const startDateCol =
            ev.startDate ?? dateOnlyFromInstantInTz(ev.startAt, tz);
          const endDateCol = ensureEndAfterStartDateExclusive(
            startDateCol,
            ev.endDate ?? dateOnlyFromInstantInTz(ev.endAt, tz),
          );

          const masterStartNaive = naiveFromDateColumn(startDateCol);
          const masterEndNaiveExclusive = naiveFromDateColumn(endDateCol);

          const masterDurationDays = Math.max(
            1,
            Math.round(
              (masterEndNaiveExclusive.getTime() - masterStartNaive.getTime()) /
                (24 * 60 * 60 * 1000),
            ),
          );

          const rule = buildFloatingRule(ruleOnly, masterStartNaive);

          const fromNaive = localMidnightNaiveFromUtcInstant(from, tz);
          const toNaive = localMidnightNaiveFromUtcInstant(to, tz);

          const occNaive = generateAfterExclusive({
            rule,
            fromNaive,
            toNaive,
            max: MAX_OCCURRENCES,
          });

          for (const occStartNaive of occNaive) {
            const occEndNaiveExclusive = addDays(
              occStartNaive,
              masterDurationDays,
            );

            // correct midnight-in-tz instants
            const occStartUtc = fromZonedTime(occStartNaive, tz);
            const occEndUtc = fromZonedTime(occEndNaiveExclusive, tz);

            if (occEndUtc <= from || occStartUtc >= to) continue;

            // also emit date-only columns for frontend layout
            const occStartDateCol = dateOnlyFromInstantInTz(occStartUtc, tz);
            const occEndDateCol = addDays(occStartDateCol, masterDurationDays);

            const originalStartAt = occStartUtc.toISOString();
            const instanceId = `${ev.id}@${originalStartAt}`;

            const instance: EventInstance = {
              id: instanceId,
              calendarId: ev.calendarId,
              title: ev.title,
              description: ev.description,
              location: ev.location,
              allDay: true,
              startAt: occStartUtc,
              endAt: occEndUtc,
              startDate: occStartDateCol,
              endDate: occEndDateCol,
              timeZone: ev.timeZone,
              color: ev.color,
              guests: ev.guests,
              notifications: ev.notifications,
              visibility: ev.visibility,
              busyStatus: ev.busyStatus,
              recurrenceRule: ev.recurrenceRule,
              recurrenceTimeZone: ev.recurrenceTimeZone,
              createdAt: ev.createdAt,
              updatedAt: ev.updatedAt,
              recurringEventId: ev.id,
              originalStartAt,
              isRecurringInstance: true,
            };

            const ex = exceptionMap.get(exceptionKey(ev.id, originalStartAt));
            const applied = ex
              ? applyExceptionToInstance(instance, ex, tz)
              : instance;
            if (!applied) continue;
            out.push(applied);
          }
        } else {
          // TIMED recurrence (timezone-aware):
          // Build a floating rule in the event timezone so weekday doesn't drift in UTC.
          const masterStartNaive = toLocalNaiveInTz(ev.startAt, tz);

          const rule = buildFloatingRule(ruleOnly, masterStartNaive);

          const fromNaive = toLocalNaiveInTz(from, tz);
          const toNaive = toLocalNaiveInTz(to, tz);

          const occNaive = generateAfterExclusive({
            rule,
            fromNaive,
            toNaive,
            max: MAX_OCCURRENCES,
          });

          for (const occStartNaive of occNaive) {
            const occStartUtc = fromZonedTime(occStartNaive, tz);
            const occEndUtc = new Date(occStartUtc.getTime() + durationMs);

            if (occEndUtc <= from || occStartUtc >= to) continue;

            const originalStartAt = occStartUtc.toISOString();
            const instanceId = `${ev.id}@${originalStartAt}`;

            const instance: EventInstance = {
              id: instanceId,
              calendarId: ev.calendarId,
              title: ev.title,
              description: ev.description,
              location: ev.location,
              allDay: false,
              startAt: occStartUtc,
              endAt: occEndUtc,
              startDate: null,
              endDate: null,
              timeZone: ev.timeZone,
              color: ev.color,
              guests: ev.guests,
              notifications: ev.notifications,
              visibility: ev.visibility,
              busyStatus: ev.busyStatus,
              recurrenceRule: ev.recurrenceRule,
              recurrenceTimeZone: ev.recurrenceTimeZone,
              createdAt: ev.createdAt,
              updatedAt: ev.updatedAt,
              recurringEventId: ev.id,
              originalStartAt,
              isRecurringInstance: true,
            };

            const ex = exceptionMap.get(exceptionKey(ev.id, originalStartAt));
            const applied = ex
              ? applyExceptionToInstance(instance, ex, tz)
              : instance;
            if (!applied) continue;
            out.push(applied);
          }
        }
      } catch {
        // fallback: return master if expansion fails
        out.push({
          id: ev.id,
          calendarId: ev.calendarId,
          title: ev.title,
          description: ev.description,
          location: ev.location,
          allDay: ev.allDay,
          startAt: ev.startAt,
          endAt: ev.endAt,
          startDate: ev.startDate,
          endDate: ev.endDate,
          timeZone: ev.timeZone,
          color: ev.color,
          guests: ev.guests,
          notifications: ev.notifications,
          visibility: ev.visibility,
          busyStatus: ev.busyStatus,
          recurrenceRule: ev.recurrenceRule,
          recurrenceTimeZone: ev.recurrenceTimeZone,
          createdAt: ev.createdAt,
          updatedAt: ev.updatedAt,
          recurringEventId: null,
          originalStartAt: null,
          isRecurringInstance: false,
        });
      }
    }

    out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return out;
  }

  async createForUser(userId: string, dto: CreateEventDto) {
    const allDay = dto.allDay ?? false;

    const startAtInput = new Date(dto.startAt);
    const endAtInput = new Date(dto.endAt);

    if (
      Number.isNaN(startAtInput.getTime()) ||
      Number.isNaN(endAtInput.getTime())
    ) {
      throw new BadRequestException('Invalid startAt/endAt');
    }
    if (endAtInput <= startAtInput) {
      throw new BadRequestException('endAt must be after startAt');
    }

    const calendarId =
      dto.calendarId ?? (await this.calendars.ensureDefaultCalendar(userId)).id;

    const cal = await this.prisma.calendar.findFirst({
      where: { id: calendarId, ownerId: userId },
      select: { id: true },
    });
    if (!cal) throw new BadRequestException('Invalid calendarId');

    const recurrenceRule = normalizeRuleOnly(dto.recurrenceRule);
    const recurrenceTimeZone =
      dto.recurrenceTimeZone ?? dto.timeZone ?? undefined;
    const tz = recurrenceTimeZone ?? dto.timeZone ?? 'UTC';

    let startDateCol: Date | null = null;
    let endDateCol: Date | null = null;

    if (allDay) {
      if (dto.startDate) startDateCol = parseDateOnly(dto.startDate);
      if (dto.endDate) endDateCol = parseDateOnly(dto.endDate);

      if (!startDateCol)
        startDateCol = dateOnlyFromInstantInTz(startAtInput, tz);

      endDateCol = ensureEndAfterStartDateExclusive(
        startDateCol,
        endDateCol ?? dateOnlyFromInstantInTz(endAtInput, tz),
      );
    }

    const normalizedStartAt = allDay
      ? fromZonedTime(naiveFromDateColumn(startDateCol!), tz)
      : startAtInput;

    const normalizedEndAt = allDay
      ? fromZonedTime(naiveFromDateColumn(endDateCol!), tz)
      : endAtInput;

    return this.prisma.event.create({
      data: {
        calendarId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        allDay,
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: allDay ? startDateCol! : null,
        endDate: allDay ? endDateCol! : null,
        timeZone: dto.timeZone,
        color: dto.color,
        recurrenceRule,
        recurrenceTimeZone,
        guests: (dto.guests ?? undefined) as Prisma.InputJsonValue | undefined,
        notifications: (dto.notifications ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        visibility: dto.visibility,
        busyStatus: dto.busyStatus,
      },
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        color: true,
        recurrenceRule: true,
        recurrenceTimeZone: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getForUser(userId: string, eventId: string) {
    const inst = parseInstanceId(eventId);

    // Case 1: master id (existing behavior)
    if (!inst) {
      const ev = await this.prisma.event.findFirst({
        where: { id: eventId, calendar: { ownerId: userId } },
        select: {
          id: true,
          calendarId: true,
          title: true,
          description: true,
          location: true,
          allDay: true,
          startAt: true,
          endAt: true,
          startDate: true,
          endDate: true,
          timeZone: true,
          color: true,
          recurrenceRule: true,
          recurrenceTimeZone: true,
          guests: true,
          notifications: true,
          visibility: true,
          busyStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      if (!ev) throw new NotFoundException('Event not found');
      return {
        ...ev,
        recurringEventId: null,
        originalStartAt: null,
        isRecurringInstance: false,
      };
    }

    // Case 2: instance id => return a synthetic occurrence
    const master = await this.prisma.event.findFirst({
      where: { id: inst.masterId, calendar: { ownerId: userId } },
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        color: true,
        recurrenceRule: true,
        recurrenceTimeZone: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!master) throw new NotFoundException('Event not found');
    if (!master.recurrenceRule) throw new NotFoundException('Event not found');

    // Build the occurrence at originalStartAt exactly
    const durationMs = master.endAt.getTime() - master.startAt.getTime();
    const occStartUtc = inst.originalStartAt;
    const occEndUtc = new Date(occStartUtc.getTime() + durationMs);

    // For all-day, also set startDate/endDate for the occurrence
    const tz = master.recurrenceTimeZone ?? master.timeZone ?? 'UTC';
    const occStartDateCol = master.allDay
      ? dateOnlyFromInstantInTz(occStartUtc, tz)
      : null;
    const occEndDateCol = master.allDay
      ? addDays(
          occStartDateCol!,
          Math.max(1, Math.round(durationMs / 86400000)),
        )
      : null;

    const base: EventInstance = {
      id: eventId, // keep instance id
      calendarId: master.calendarId,
      title: master.title,
      description: master.description,
      location: master.location,
      allDay: master.allDay,
      startAt: occStartUtc,
      endAt: occEndUtc,
      startDate: occStartDateCol,
      endDate: occEndDateCol,
      timeZone: master.timeZone,
      color: master.color,
      guests: master.guests,
      notifications: master.notifications,
      visibility: master.visibility,
      busyStatus: master.busyStatus,
      recurrenceRule: master.recurrenceRule,
      recurrenceTimeZone: master.recurrenceTimeZone,
      createdAt: master.createdAt,
      updatedAt: master.updatedAt,
      recurringEventId: master.id,
      originalStartAt: occStartUtc.toISOString(),
      isRecurringInstance: true,
    };

    const ex = await this.prisma.eventRecurrenceException.findUnique({
      where: {
        eventId_originalStartAt: {
          eventId: master.id,
          originalStartAt: inst.originalStartAt,
        },
      },
      select: {
        cancelled: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        color: true,
        timeZone: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
      },
    });

    if (!ex) return base;

    const applied = applyExceptionToInstance(base, ex, tz);
    if (!applied) throw new NotFoundException('Event not found');
    return applied;
  }

  async updateForUser(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
    scope: RecurrenceScope = 'all',
  ) {
    const inst = parseInstanceId(eventId);
    const masterId = inst?.masterId ?? eventId;

    const existing = await this.prisma.event.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        recurrenceTimeZone: true,
        recurrenceRule: true,
        color: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
        calendar: { select: { ownerId: true } },
      },
    });

    if (!existing) throw new NotFoundException('Event not found');
    if (existing.calendar.ownerId !== userId)
      throw new ForbiddenException('Forbidden');

    if ((scope === 'this' || scope === 'following') && !inst) {
      throw new BadRequestException('scope requires instance id');
    }
    if (
      (scope === 'this' || scope === 'following') &&
      !existing.recurrenceRule
    ) {
      throw new BadRequestException('scope requires recurring event');
    }

    if (scope === 'this') {
      const tz = existing.recurrenceTimeZone ?? existing.timeZone ?? 'UTC';
      const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
      const occStartUtc = inst!.originalStartAt;
      const occEndUtc = new Date(occStartUtc.getTime() + durationMs);

      const baseStartDate = existing.allDay
        ? dateOnlyFromInstantInTz(occStartUtc, tz)
        : null;
      const baseDurationDays = existing.allDay
        ? Math.max(
            1,
            Math.round(
              ((
                existing.endDate ?? dateOnlyFromInstantInTz(existing.endAt, tz)
              ).getTime() -
                (
                  existing.startDate ??
                  dateOnlyFromInstantInTz(existing.startAt, tz)
                ).getTime()) /
                86400000,
            ),
          )
        : 0;
      const baseEndDate = existing.allDay
        ? addDays(baseStartDate!, baseDurationDays)
        : null;

      const nextAllDay = dto.allDay ?? existing.allDay;

      const parsedStartAt =
        dto.startAt !== undefined ? new Date(dto.startAt) : undefined;
      const parsedEndAt =
        dto.endAt !== undefined ? new Date(dto.endAt) : undefined;

      if (parsedStartAt && Number.isNaN(parsedStartAt.getTime())) {
        throw new BadRequestException('Invalid startAt');
      }
      if (parsedEndAt && Number.isNaN(parsedEndAt.getTime())) {
        throw new BadRequestException('Invalid endAt');
      }

      const nextStartAtInput = parsedStartAt ?? occStartUtc;
      const nextEndAtInput = parsedEndAt ?? occEndUtc;

      if (nextEndAtInput <= nextStartAtInput) {
        throw new BadRequestException('endAt must be after startAt');
      }

      const nextTimeZone = dto.timeZone ?? existing.timeZone ?? undefined;
      const nextRecurrenceTimeZone =
        dto.recurrenceTimeZone !== undefined
          ? dto.recurrenceTimeZone
          : dto.timeZone !== undefined
            ? dto.timeZone
            : (existing.recurrenceTimeZone ?? undefined);

      const tzForNormalize = nextRecurrenceTimeZone ?? nextTimeZone ?? 'UTC';

      let nextStartDateCol = baseStartDate;
      let nextEndDateCol = baseEndDate;

      if (nextAllDay) {
        if (dto.startDate !== undefined) {
          nextStartDateCol = dto.startDate
            ? parseDateOnly(dto.startDate)
            : null;
        }
        if (dto.endDate !== undefined) {
          nextEndDateCol = dto.endDate ? parseDateOnly(dto.endDate) : null;
        }

        if (!nextStartDateCol)
          nextStartDateCol = dateOnlyFromInstantInTz(
            nextStartAtInput,
            tzForNormalize,
          );

        nextEndDateCol = ensureEndAfterStartDateExclusive(
          nextStartDateCol,
          nextEndDateCol ??
            dateOnlyFromInstantInTz(nextEndAtInput, tzForNormalize),
        );
      } else {
        nextStartDateCol = null;
        nextEndDateCol = null;
      }

      const normalizedStartAt = nextAllDay
        ? fromZonedTime(naiveFromDateColumn(nextStartDateCol!), tzForNormalize)
        : nextStartAtInput;

      const normalizedEndAt = nextAllDay
        ? fromZonedTime(naiveFromDateColumn(nextEndDateCol!), tzForNormalize)
        : nextEndAtInput;

      const hasTimeChange =
        dto.startAt !== undefined ||
        dto.endAt !== undefined ||
        dto.allDay !== undefined ||
        dto.startDate !== undefined ||
        dto.endDate !== undefined ||
        dto.timeZone !== undefined ||
        dto.recurrenceTimeZone !== undefined;

      const exceptionData: Record<string, unknown> = {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.guests !== undefined ? { guests: dto.guests } : {}),
        ...(dto.notifications !== undefined
          ? { notifications: dto.notifications }
          : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.busyStatus !== undefined ? { busyStatus: dto.busyStatus } : {}),
        ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
        ...(dto.allDay !== undefined ? { allDay: nextAllDay } : {}),
      };

      if (hasTimeChange) {
        Object.assign(exceptionData, {
          startAt: normalizedStartAt,
          endAt: normalizedEndAt,
          ...(nextAllDay
            ? { startDate: nextStartDateCol, endDate: nextEndDateCol }
            : {}),
        });
      }

      await this.prisma.eventRecurrenceException.upsert({
        where: {
          eventId_originalStartAt: {
            eventId: masterId,
            originalStartAt: inst!.originalStartAt,
          },
        },
        create: {
          event: { connect: { id: masterId } },
          originalStartAt: inst!.originalStartAt,
          cancelled: false,
          ...exceptionData,
        },
        update: {
          cancelled: false,
          ...exceptionData,
        },
      });

      return this.getForUser(userId, eventId);
    }

    if (scope === 'following') {
      const tz = existing.recurrenceTimeZone ?? existing.timeZone ?? 'UTC';
      const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
      const occStartUtc = inst!.originalStartAt;
      const occEndUtc = new Date(occStartUtc.getTime() + durationMs);
      const occStartLocal = toZonedTime(occStartUtc, tz);
      const occStartLocalMidnight = new Date(
        occStartLocal.getFullYear(),
        occStartLocal.getMonth(),
        occStartLocal.getDate(),
        0,
        0,
        0,
        0,
      );

      const baseStartDate = existing.allDay
        ? dateOnlyFromInstantInTz(occStartUtc, tz)
        : null;
      const baseDurationDays = existing.allDay
        ? Math.max(
            1,
            Math.round(
              ((
                existing.endDate ?? dateOnlyFromInstantInTz(existing.endAt, tz)
              ).getTime() -
                (
                  existing.startDate ??
                  dateOnlyFromInstantInTz(existing.startAt, tz)
                ).getTime()) /
                86400000,
            ),
          )
        : 0;
      const baseEndDate = existing.allDay
        ? addDays(baseStartDate!, baseDurationDays)
        : null;

      const nextAllDay = dto.allDay ?? existing.allDay;

      const parsedStartAt =
        dto.startAt !== undefined ? new Date(dto.startAt) : undefined;
      const parsedEndAt =
        dto.endAt !== undefined ? new Date(dto.endAt) : undefined;

      if (parsedStartAt && Number.isNaN(parsedStartAt.getTime())) {
        throw new BadRequestException('Invalid startAt');
      }
      if (parsedEndAt && Number.isNaN(parsedEndAt.getTime())) {
        throw new BadRequestException('Invalid endAt');
      }

      const nextStartAtInput = parsedStartAt ?? occStartUtc;
      const nextEndAtInput = parsedEndAt ?? occEndUtc;

      if (nextEndAtInput <= nextStartAtInput) {
        throw new BadRequestException('endAt must be after startAt');
      }

      const nextRecurrenceRule =
        dto.recurrenceRule !== undefined
          ? normalizeRuleOnly(dto.recurrenceRule)
          : stripUntil(existing.recurrenceRule!);

      const nextTimeZone = dto.timeZone ?? existing.timeZone ?? undefined;
      const nextRecurrenceTimeZone =
        dto.recurrenceTimeZone !== undefined
          ? dto.recurrenceTimeZone
          : dto.timeZone !== undefined
            ? dto.timeZone
            : (existing.recurrenceTimeZone ?? undefined);

      const tzForNormalize = nextRecurrenceTimeZone ?? nextTimeZone ?? 'UTC';

      let nextStartDateCol = baseStartDate;
      let nextEndDateCol = baseEndDate;

      if (nextAllDay) {
        if (dto.startDate !== undefined) {
          nextStartDateCol = dto.startDate
            ? parseDateOnly(dto.startDate)
            : null;
        }
        if (dto.endDate !== undefined) {
          nextEndDateCol = dto.endDate ? parseDateOnly(dto.endDate) : null;
        }

        if (!nextStartDateCol)
          nextStartDateCol = dateOnlyFromInstantInTz(
            nextStartAtInput,
            tzForNormalize,
          );

        nextEndDateCol = ensureEndAfterStartDateExclusive(
          nextStartDateCol,
          nextEndDateCol ??
            dateOnlyFromInstantInTz(nextEndAtInput, tzForNormalize),
        );
      } else {
        nextStartDateCol = null;
        nextEndDateCol = null;
      }

      const normalizedStartAt = nextAllDay
        ? fromZonedTime(naiveFromDateColumn(nextStartDateCol!), tzForNormalize)
        : nextStartAtInput;

      const normalizedEndAt = nextAllDay
        ? fromZonedTime(naiveFromDateColumn(nextEndDateCol!), tzForNormalize)
        : nextEndAtInput;

      const truncatedRule = existing.allDay
        ? withUntilFloating(
            existing.recurrenceRule!,
            addMilliseconds(occStartLocalMidnight, -1),
          )
        : withUntil(existing.recurrenceRule!, addMilliseconds(occStartUtc, -1));

      await this.prisma.event.update({
        where: { id: masterId },
        data: { recurrenceRule: truncatedRule },
      });

      return this.prisma.event.create({
        data: {
          calendarId: existing.calendarId,
          title: dto.title ?? existing.title,
          description: dto.description ?? existing.description,
          location: dto.location ?? existing.location,
          allDay: nextAllDay,
          startAt: normalizedStartAt,
          endAt: normalizedEndAt,
          startDate: nextAllDay ? nextStartDateCol! : null,
          endDate: nextAllDay ? nextEndDateCol! : null,
          timeZone: nextTimeZone,
          color: dto.color ?? existing.color,
          recurrenceRule: nextRecurrenceRule,
          recurrenceTimeZone: nextRecurrenceTimeZone,
          guests: (dto.guests ?? existing.guests ?? undefined) as
            | Prisma.InputJsonValue
            | undefined,
          notifications: (dto.notifications ??
            existing.notifications ??
            undefined) as Prisma.InputJsonValue | undefined,
          visibility: dto.visibility ?? existing.visibility ?? undefined,
          busyStatus: dto.busyStatus ?? existing.busyStatus ?? undefined,
        },
        select: {
          id: true,
          calendarId: true,
          title: true,
          description: true,
          location: true,
          allDay: true,
          startAt: true,
          endAt: true,
          startDate: true,
          endDate: true,
          timeZone: true,
          color: true,
          recurrenceRule: true,
          recurrenceTimeZone: true,
          guests: true,
          notifications: true,
          visibility: true,
          busyStatus: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    }

    const nextAllDay = dto.allDay ?? existing.allDay;

    const parsedStartAt =
      dto.startAt !== undefined ? new Date(dto.startAt) : undefined;
    const parsedEndAt =
      dto.endAt !== undefined ? new Date(dto.endAt) : undefined;

    if (parsedStartAt && Number.isNaN(parsedStartAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }
    if (parsedEndAt && Number.isNaN(parsedEndAt.getTime())) {
      throw new BadRequestException('Invalid endAt');
    }

    const nextRecurrenceRule =
      dto.recurrenceRule !== undefined
        ? normalizeRuleOnly(dto.recurrenceRule)
        : undefined;

    const nextTimeZone = dto.timeZone ?? existing.timeZone ?? undefined;

    const nextRecurrenceTimeZone =
      dto.recurrenceTimeZone !== undefined
        ? dto.recurrenceTimeZone
        : dto.timeZone !== undefined
          ? dto.timeZone
          : (existing.recurrenceTimeZone ?? undefined);

    const tz = nextRecurrenceTimeZone ?? nextTimeZone ?? 'UTC';

    const isInstanceScopeAll = !!inst && scope === 'all';

    const setUtcTime = (base: Date, src: Date) =>
      new Date(
        Date.UTC(
          base.getUTCFullYear(),
          base.getUTCMonth(),
          base.getUTCDate(),
          src.getUTCHours(),
          src.getUTCMinutes(),
          src.getUTCSeconds(),
          src.getUTCMilliseconds(),
        ),
      );

    const nextStartAtInput = isInstanceScopeAll
      ? parsedStartAt
        ? setUtcTime(existing.startAt, parsedStartAt)
        : existing.startAt
      : (parsedStartAt ?? existing.startAt);

    const nextEndAtInput = isInstanceScopeAll
      ? parsedEndAt
        ? setUtcTime(existing.endAt, parsedEndAt)
        : existing.endAt
      : (parsedEndAt ?? existing.endAt);

    let nextStartDateCol = existing.startDate;
    let nextEndDateCol = existing.endDate;

    if (nextAllDay) {
      const effectiveStartDate = isInstanceScopeAll ? undefined : dto.startDate;
      const effectiveEndDate = isInstanceScopeAll ? undefined : dto.endDate;

      if (effectiveStartDate !== undefined) {
        nextStartDateCol = effectiveStartDate
          ? parseDateOnly(effectiveStartDate)
          : null;
      }
      if (effectiveEndDate !== undefined) {
        nextEndDateCol = effectiveEndDate
          ? parseDateOnly(effectiveEndDate)
          : null;
      }

      if (!nextStartDateCol)
        nextStartDateCol = dateOnlyFromInstantInTz(nextStartAtInput, tz);

      nextEndDateCol = ensureEndAfterStartDateExclusive(
        nextStartDateCol,
        nextEndDateCol ?? dateOnlyFromInstantInTz(nextEndAtInput, tz),
      );
    } else {
      nextStartDateCol = null;
      nextEndDateCol = null;
    }

    const normalizedStartAt = nextAllDay
      ? fromZonedTime(naiveFromDateColumn(nextStartDateCol!), tz)
      : nextStartAtInput;

    const normalizedEndAt = nextAllDay
      ? fromZonedTime(naiveFromDateColumn(nextEndDateCol!), tz)
      : nextEndAtInput;

    return this.prisma.event.update({
      where: { id: masterId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
        ...(dto.guests !== undefined
          ? { guests: dto.guests as Prisma.InputJsonValue }
          : {}),
        ...(dto.notifications !== undefined
          ? { notifications: dto.notifications as Prisma.InputJsonValue }
          : {}),
        ...(dto.visibility !== undefined ? { visibility: dto.visibility } : {}),
        ...(dto.busyStatus !== undefined ? { busyStatus: dto.busyStatus } : {}),
        ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
        ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
        ...(dto.recurrenceTimeZone !== undefined
          ? { recurrenceTimeZone: dto.recurrenceTimeZone }
          : dto.timeZone !== undefined
            ? { recurrenceTimeZone: dto.timeZone }
            : {}),
        ...(nextRecurrenceRule !== undefined
          ? { recurrenceRule: nextRecurrenceRule }
          : {}),
        startAt: normalizedStartAt,
        endAt: normalizedEndAt,
        startDate: nextStartDateCol,
        endDate: nextEndDateCol,
      },
      select: {
        id: true,
        calendarId: true,
        title: true,
        description: true,
        location: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        color: true,
        recurrenceRule: true,
        recurrenceTimeZone: true,
        guests: true,
        notifications: true,
        visibility: true,
        busyStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteForUser(
    userId: string,
    eventId: string,
    scope: RecurrenceScope = 'all',
  ) {
    const inst = parseInstanceId(eventId);
    const masterId = inst?.masterId ?? eventId;

    const existing = await this.prisma.event.findUnique({
      where: { id: masterId },
      select: {
        id: true,
        recurrenceRule: true,
        timeZone: true,
        recurrenceTimeZone: true,
        allDay: true,
        calendar: { select: { ownerId: true } },
      },
    });

    if (!existing) throw new NotFoundException('Event not found');
    if (existing.calendar.ownerId !== userId)
      throw new ForbiddenException('Forbidden');

    if ((scope === 'this' || scope === 'following') && !inst) {
      throw new BadRequestException('scope requires instance id');
    }
    if (
      (scope === 'this' || scope === 'following') &&
      !existing.recurrenceRule
    ) {
      throw new BadRequestException('scope requires recurring event');
    }

    if (scope === 'this') {
      await this.prisma.eventRecurrenceException.upsert({
        where: {
          eventId_originalStartAt: {
            eventId: masterId,
            originalStartAt: inst!.originalStartAt,
          },
        },
        create: {
          event: { connect: { id: masterId } },
          originalStartAt: inst!.originalStartAt,
          cancelled: true,
        },
        update: { cancelled: true },
      });
      return { ok: true };
    }

    if (scope === 'following') {
      const tz = existing.recurrenceTimeZone ?? existing.timeZone ?? 'UTC';
      const occStartLocal = toZonedTime(inst!.originalStartAt, tz);
      const occStartLocalMidnight = new Date(
        occStartLocal.getFullYear(),
        occStartLocal.getMonth(),
        occStartLocal.getDate(),
        0,
        0,
        0,
        0,
      );
      const truncatedRule = existing.allDay
        ? withUntilFloating(
            existing.recurrenceRule!,
            addMilliseconds(occStartLocalMidnight, -1),
          )
        : withUntil(
            existing.recurrenceRule!,
            addMilliseconds(inst!.originalStartAt, -1),
          );
      await this.prisma.event.update({
        where: { id: masterId },
        data: { recurrenceRule: truncatedRule },
      });
      return { ok: true };
    }

    await this.prisma.event.delete({ where: { id: masterId } });
    return { ok: true };
  }
}
