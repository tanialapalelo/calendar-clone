import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { addDays, addMilliseconds } from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Prisma } from '@prisma/client';

import { CalendarsService } from '../calendars/calendars.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { stripUntil, withUntil, withUntilFloating } from './rrule-until';

import {
  EVENT_SELECT,
  EXCEPTION_SELECT,
  EventInstance,
  ExceptionRow,
} from './event-select';
import {
  dateOnlyFromInstantInTz,
  ensureEndAfterStartDateExclusive,
  naiveFromDateColumn,
  parseDateOnly,
} from './recurrence/date-utils';
import { normalizeRuleOnly } from './recurrence/rule';
import { parseInstanceId } from './recurrence/instance-id';
import { applyExceptionToInstance } from './recurrence/exceptions';
import { expandRecurringMaster, masterToInstance } from './recurrence/expand';
import type { RecurrenceScope } from './recurrence/scope';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: CalendarsService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // READ
  // ─────────────────────────────────────────────────────────────────────

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
      select: EVENT_SELECT,
    });

    const recurringIds = events
      .filter((ev) => !!ev.recurrenceRule)
      .map((ev) => ev.id);

    const exceptions: ExceptionRow[] = recurringIds.length
      ? await this.prisma.eventRecurrenceException.findMany({
          where: {
            eventId: { in: recurringIds },
            originalStartAt: { gte: from, lt: to },
          },
          select: EXCEPTION_SELECT,
        })
      : [];

    const exceptionMap = new Map<string, ExceptionRow>();
    for (const ex of exceptions) {
      exceptionMap.set(`${ex.eventId}|${ex.originalStartAt.toISOString()}`, ex);
    }

    const out: EventInstance[] = [];
    for (const ev of events) {
      if (!ev.recurrenceRule) {
        out.push(masterToInstance(ev));
      } else {
        out.push(...expandRecurringMaster(ev, from, to, exceptionMap));
      }
    }

    out.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return out;
  }

  async searchForUser(
    userId: string,
    query: string,
    limit = 20,
  ): Promise<EventInstance[]> {
    if (!query.trim()) return [];
    const events = await this.prisma.event.findMany({
      where: {
        calendar: { ownerId: userId },
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: { startAt: 'desc' },
      take: limit,
      select: EVENT_SELECT,
    });
    return events.map(masterToInstance);
  }

  async getForUser(userId: string, eventId: string): Promise<EventInstance> {
    const inst = parseInstanceId(eventId);

    // Case 1: master id
    if (!inst) {
      const ev = await this.prisma.event.findFirst({
        where: { id: eventId, calendar: { ownerId: userId } },
        select: EVENT_SELECT,
      });
      if (!ev) throw new NotFoundException('Event not found');
      return masterToInstance(ev);
    }

    // Case 2: instance id
    const master = await this.prisma.event.findFirst({
      where: { id: inst.masterId, calendar: { ownerId: userId } },
      select: EVENT_SELECT,
    });
    if (!master || !master.recurrenceRule)
      throw new NotFoundException('Event not found');

    const tz = master.recurrenceTimeZone ?? master.timeZone ?? 'UTC';
    const durationMs = master.endAt.getTime() - master.startAt.getTime();
    const occStartUtc = inst.originalStartAt;
    const occEndUtc = new Date(occStartUtc.getTime() + durationMs);

    const occStartDateCol = master.allDay
      ? dateOnlyFromInstantInTz(occStartUtc, tz)
      : null;
    const occEndDateCol = master.allDay
      ? addDays(
          occStartDateCol!,
          Math.max(1, Math.round(durationMs / 86_400_000)),
        )
      : null;

    const base: EventInstance = {
      ...master,
      id: eventId,
      startAt: occStartUtc,
      endAt: occEndUtc,
      startDate: occStartDateCol,
      endDate: occEndDateCol,
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
      select: EXCEPTION_SELECT,
    });
    if (!ex) return base;

    const applied = applyExceptionToInstance(base, ex, tz);
    if (!applied) throw new NotFoundException('Event not found');
    return applied;
  }

  // ─────────────────────────────────────────────────────────────────────
  // CREATE
  // ─────────────────────────────────────────────────────────────────────

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
      select: EVENT_SELECT,
    });
  }

  // ─────────────────────────────────────────────────────────────────────
  // UPDATE / DELETE  (logic unchanged — just trimmed and shares helpers)
  // ─────────────────────────────────────────────────────────────────────

  async updateForUser(
    userId: string,
    eventId: string,
    dto: UpdateEventDto,
    scope: RecurrenceScope = 'all',
  ) {
    const inst = parseInstanceId(eventId);
    const masterId = inst?.masterId ?? eventId;

    const existing = await this.prisma.event.findFirst({
      where: { id: masterId, calendar: { ownerId: userId } },
      select: { ...EVENT_SELECT, calendar: { select: { ownerId: true } } },
    });

    if (!existing) throw new NotFoundException('Event not found');

    if ((scope === 'this' || scope === 'following') && !inst) {
      throw new BadRequestException('scope requires instance id');
    }
    if (
      (scope === 'this' || scope === 'following') &&
      !existing.recurrenceRule
    ) {
      throw new BadRequestException('scope requires recurring event');
    }

    if (scope === 'this')
      return this.updateThisOccurrence(existing, inst!, dto, eventId, userId);
    if (scope === 'following')
      return this.updateFollowing(existing, inst!, dto);
    return this.updateAll(existing, inst, dto);
  }

  // ── private helpers extracted from your existing branches ─────────────

  private async updateThisOccurrence(
    existing: Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>,
    inst: { masterId: string; originalStartAt: Date },
    dto: UpdateEventDto,
    eventId: string,
    userId: string,
  ) {
    const tz = existing.recurrenceTimeZone ?? existing.timeZone ?? 'UTC';
    const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
    const occStartUtc = inst.originalStartAt;
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
              86_400_000,
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
    if (parsedStartAt && Number.isNaN(parsedStartAt.getTime()))
      throw new BadRequestException('Invalid startAt');
    if (parsedEndAt && Number.isNaN(parsedEndAt.getTime()))
      throw new BadRequestException('Invalid endAt');

    const nextStartAtInput = parsedStartAt ?? occStartUtc;
    const nextEndAtInput = parsedEndAt ?? occEndUtc;
    if (nextEndAtInput <= nextStartAtInput)
      throw new BadRequestException('endAt must be after startAt');

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
      if (dto.startDate !== undefined)
        nextStartDateCol = dto.startDate ? parseDateOnly(dto.startDate) : null;
      if (dto.endDate !== undefined)
        nextEndDateCol = dto.endDate ? parseDateOnly(dto.endDate) : null;
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
          eventId: inst.masterId,
          originalStartAt: inst.originalStartAt,
        },
      },
      create: {
        event: { connect: { id: inst.masterId } },
        originalStartAt: inst.originalStartAt,
        cancelled: false,
        ...exceptionData,
      },
      update: { cancelled: false, ...exceptionData },
    });

    return this.getForUser(userId, eventId);
  }

  private async updateFollowing(
    existing: Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>,
    inst: { masterId: string; originalStartAt: Date },
    dto: UpdateEventDto,
  ) {
    const tz = existing.recurrenceTimeZone ?? existing.timeZone ?? 'UTC';
    const durationMs = existing.endAt.getTime() - existing.startAt.getTime();
    const occStartUtc = inst.originalStartAt;
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
              86_400_000,
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
    if (parsedStartAt && Number.isNaN(parsedStartAt.getTime()))
      throw new BadRequestException('Invalid startAt');
    if (parsedEndAt && Number.isNaN(parsedEndAt.getTime()))
      throw new BadRequestException('Invalid endAt');

    const nextStartAtInput = parsedStartAt ?? occStartUtc;
    const nextEndAtInput = parsedEndAt ?? occEndUtc;
    if (nextEndAtInput <= nextStartAtInput)
      throw new BadRequestException('endAt must be after startAt');

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
      if (dto.startDate !== undefined)
        nextStartDateCol = dto.startDate ? parseDateOnly(dto.startDate) : null;
      if (dto.endDate !== undefined)
        nextEndDateCol = dto.endDate ? parseDateOnly(dto.endDate) : null;
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
      where: { id: existing.id },
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
      select: EVENT_SELECT,
    });
  }

  private updateAll(
    existing: Prisma.EventGetPayload<{ select: typeof EVENT_SELECT }>,
    inst: { masterId: string; originalStartAt: Date } | null,
    dto: UpdateEventDto,
  ) {
    const nextAllDay = dto.allDay ?? existing.allDay;
    const parsedStartAt =
      dto.startAt !== undefined ? new Date(dto.startAt) : undefined;
    const parsedEndAt =
      dto.endAt !== undefined ? new Date(dto.endAt) : undefined;
    if (parsedStartAt && Number.isNaN(parsedStartAt.getTime()))
      throw new BadRequestException('Invalid startAt');
    if (parsedEndAt && Number.isNaN(parsedEndAt.getTime()))
      throw new BadRequestException('Invalid endAt');

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

    const isInstanceScopeAll = !!inst;

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
      if (effectiveStartDate !== undefined)
        nextStartDateCol = effectiveStartDate
          ? parseDateOnly(effectiveStartDate)
          : null;
      if (effectiveEndDate !== undefined)
        nextEndDateCol = effectiveEndDate
          ? parseDateOnly(effectiveEndDate)
          : null;
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
      where: { id: existing.id },
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
      select: EVENT_SELECT,
    });
  }

  async deleteForUser(
    userId: string,
    eventId: string,
    scope: RecurrenceScope = 'all',
  ) {
    const inst = parseInstanceId(eventId);
    const masterId = inst?.masterId ?? eventId;

    const existing = await this.prisma.event.findFirst({
      where: { id: masterId, calendar: { ownerId: userId } },
      select: {
        id: true,
        recurrenceRule: true,
        timeZone: true,
        recurrenceTimeZone: true,
        allDay: true,
      },
    });
    if (!existing) throw new NotFoundException('Event not found');

    if ((scope === 'this' || scope === 'following') && !inst)
      throw new BadRequestException('scope requires instance id');
    if ((scope === 'this' || scope === 'following') && !existing.recurrenceRule)
      throw new BadRequestException('scope requires recurring event');

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

  // Kept for callers that import this from the old module path.
  // (You can delete once nothing imports it.)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _unused_keepForReExports(_: ExceptionRow) {}

  // Re-export for backward compat if anything imports it from this file:
  static normalizeRuleOnly = normalizeRuleOnly;
}
