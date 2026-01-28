import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarsService {
  constructor(private readonly prisma: PrismaService) {}

  async listForUser(userId: string) {
    return this.prisma.calendar.findMany({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async ensureDefaultCalendar(userId: string) {
    const existing = await this.prisma.calendar.findFirst({
      where: { ownerId: userId },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (existing) return existing;

    return this.prisma.calendar.create({
      data: { ownerId: userId, name: 'Personal', color: '#2563eb' },
      select: {
        id: true,
        name: true,
        color: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
