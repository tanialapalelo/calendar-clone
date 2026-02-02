import {
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly calendars: CalendarsService,
  ) {}

  async listForUser(userId: string, from?: Date, to?: Date) {
    return this.prisma.event.findMany({
      where: {
        calendar: { ownerId: userId },
        ...(from || to
          ? {
              AND: [
                from ? { endAt: { gt: from } } : {},
                to ? { startAt: { lt: to } } : {},
              ],
            }
          : {}),
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
        timeZone: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async createForUser(userId: string, dto: CreateEventDto) {
    const startAt = new Date(dto.startAt);
    const endAt = new Date(dto.endAt);

    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      throw new BadRequestException('Invalid startAt/endAt');
    }
    if (endAt <= startAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    const calendarId =
      dto.calendarId ?? (await this.calendars.ensureDefaultCalendar(userId)).id;

    const cal = await this.prisma.calendar.findFirst({
      where: { id: calendarId, ownerId: userId },
      select: { id: true },
    });
    if (!cal) throw new BadRequestException('Invalid calendarId');

    return this.prisma.event.create({
      data: {
        calendarId,
        title: dto.title,
        description: dto.description,
        location: dto.location,
        allDay: dto.allDay ?? false,
        startAt,
        endAt,
        timeZone: dto.timeZone,
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
        timeZone: true,
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
        startAt: true,
        endAt: true,
        calendar: { select: { ownerId: true } },
      },
    });

    if (!existing) throw new NotFoundException('Event not found');
    if (existing.calendar.ownerId !== userId)
      throw new ForbiddenException('Forbidden');

    // Parse/validate dates if present
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

    const nextStartAt = parsedStartAt ?? existing.startAt;
    const nextEndAt = parsedEndAt ?? existing.endAt;

    if (nextEndAt <= nextStartAt) {
      throw new BadRequestException('endAt must be after startAt');
    }

    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined
          ? { description: dto.description }
          : {}),
        ...(dto.location !== undefined ? { location: dto.location } : {}),
        ...(dto.allDay !== undefined ? { allDay: dto.allDay } : {}),
        ...(parsedStartAt !== undefined ? { startAt: parsedStartAt } : {}),
        ...(parsedEndAt !== undefined ? { endAt: parsedEndAt } : {}),
        ...(dto.timeZone !== undefined ? { timeZone: dto.timeZone } : {}),
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
        timeZone: true,
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
