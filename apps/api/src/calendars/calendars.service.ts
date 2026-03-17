import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalendarDto } from './dto/create-calendar.dto';
import { UpdateCalendarDto } from './dto/update-calendar.dto';

/** Fields returned for every calendar response — never expose ownerId directly. */
const CALENDAR_SELECT = {
  id: true,
  name: true,
  color: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class CalendarsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Read ──────────────────────────────────────────────────────────────────

  listForUser(userId: string) {
    return this.prisma.calendar.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: CALENDAR_SELECT,
    });
  }

  async getForUser(userId: string, id: string) {
    const cal = await this.prisma.calendar.findUnique({
      where: { id },
      select: { ...CALENDAR_SELECT, ownerId: true },
    });
    if (!cal) throw new NotFoundException('Calendar not found');
    if (cal.ownerId !== userId) throw new ForbiddenException();
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { ownerId: _, ...rest } = cal;
    return rest;
  }

  // ── Create ────────────────────────────────────────────────────────────────

  createForUser(userId: string, dto: CreateCalendarDto) {
    return this.prisma.calendar.create({
      data: {
        ownerId: userId,
        name: dto.name,
        color: dto.color ?? '#039BE5',
      },
      select: CALENDAR_SELECT,
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async updateForUser(userId: string, id: string, dto: UpdateCalendarDto) {
    await this.getForUser(userId, id); // throws 404 / 403 if not owned
    return this.prisma.calendar.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.color !== undefined && { color: dto.color }),
      },
      select: CALENDAR_SELECT,
    });
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  async deleteForUser(userId: string, id: string) {
    await this.getForUser(userId, id); // throws 404 / 403 if not owned
    await this.prisma.calendar.delete({ where: { id } });
  }

  // ── Utility ───────────────────────────────────────────────────────────────

  async ensureDefaultCalendar(userId: string) {
    const existing = await this.prisma.calendar.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: CALENDAR_SELECT,
    });
    if (existing) return existing;

    return this.prisma.calendar.create({
      data: { ownerId: userId, name: 'Personal', color: '#0B57D0' },
      select: CALENDAR_SELECT,
    });
  }
}
