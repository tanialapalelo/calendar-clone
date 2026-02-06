import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, addMilliseconds } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { RRule, rrulestr } from 'rrule';

import { CalendarsService } from '../calendars/calendars.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

type EventInstance = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;

  startAt: Date;
  endAt: Date;

  /**
   * All-day source of truth (half-open):
   * - startDate inclusive
   * - endDate exclusive
   * null for timed events
   */
  startDate: Date | null;
  endDate: Date | null;

  timeZone: string | null;
  color: string | null;
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
  const parsed = rrulestr(s);
  if (!(parsed instanceof RRule)) throw new Error('Expected RRule');
  return parsed;
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
        createdAt: true,
        updatedAt: true,
      },
    });

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

            out.push({
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
              recurrenceRule: ev.recurrenceRule,
              recurrenceTimeZone: ev.recurrenceTimeZone,
              createdAt: ev.createdAt,
              updatedAt: ev.updatedAt,
              recurringEventId: ev.id,
              originalStartAt,
              isRecurringInstance: true,
            });
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

            out.push({
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
              recurrenceRule: ev.recurrenceRule,
              recurrenceTimeZone: ev.recurrenceTimeZone,
              createdAt: ev.createdAt,
              updatedAt: ev.updatedAt,
              recurringEventId: ev.id,
              originalStartAt,
              isRecurringInstance: true,
            });
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
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async getForUser(userId: string, eventId: string) {
    const ev = await this.prisma.event.findFirst({
      where: { id: eventId, calendar: { ownerId: userId } },
    });

    if (!ev) throw new NotFoundException('Event not found');
    return ev;
  }

  async updateForUser(userId: string, eventId: string, dto: UpdateEventDto) {
    const existing = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        calendarId: true,
        allDay: true,
        startAt: true,
        endAt: true,
        startDate: true,
        endDate: true,
        timeZone: true,
        recurrenceTimeZone: true,
        recurrenceRule: true,
        calendar: { select: { ownerId: true } },
      },
    });

    if (!existing) throw new NotFoundException('Event not found');
    if (existing.calendar.ownerId !== userId)
      throw new ForbiddenException('Forbidden');

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

    const nextStartAtInput = parsedStartAt ?? existing.startAt;
    const nextEndAtInput = parsedEndAt ?? existing.endAt;

    if (nextEndAtInput <= nextStartAtInput) {
      throw new BadRequestException('endAt must be after startAt');
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

    let nextStartDateCol = existing.startDate;
    let nextEndDateCol = existing.endDate;

    if (nextAllDay) {
      if (dto.startDate !== undefined) {
        nextStartDateCol = dto.startDate ? parseDateOnly(dto.startDate) : null;
      }
      if (dto.endDate !== undefined) {
        nextEndDateCol = dto.endDate ? parseDateOnly(dto.endDate) : null;
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
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.color !== undefined ? { color: dto.color } : {}),
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
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async deleteForUser(userId: string, eventId: string) {
    const existing = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        calendar: { select: { ownerId: true } },
      },
    });

    if (!existing) throw new NotFoundException('Event not found');
    if (existing.calendar.ownerId !== userId)
      throw new ForbiddenException('Forbidden');

    await this.prisma.event.delete({ where: { id: eventId } });
    return { ok: true };
  }
}
