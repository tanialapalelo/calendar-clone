import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarsService } from '../calendars/calendars.service';
import { CreateEventDto } from './dto/create-event.dto';

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

    // Enforce calendar ownership (prevents creating events in other users' calendars)
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
}
