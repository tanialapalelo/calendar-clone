import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import type { AuthUser } from '../auth/auth.types';
import { CalendarsService } from './calendars.service';

@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendars: CalendarsService) {}

  @Get()
  @UseGuards(JwtCookieGuard)
  async list(@Req() req: Request & { user?: AuthUser }) {
    const userId = req.user!.sub;
    // Create a default calendar so the app works immediately after first login
    await this.calendars.ensureDefaultCalendar(userId);
    return this.calendars.listForUser(userId);
  }
}
