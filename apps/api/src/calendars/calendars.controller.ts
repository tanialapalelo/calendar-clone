import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { CalendarsService } from './calendars.service';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import type { RequestWithUser } from '../auth/auth.types';

@Controller('calendars')
export class CalendarsController {
  constructor(private readonly calendars: CalendarsService) {}

  @Get()
  @UseGuards(JwtCookieGuard)
  async list(@Req() req: RequestWithUser) {
    const userId = req.user!.sub;
    await this.calendars.ensureDefaultCalendar(userId);
    return this.calendars.listForUser(userId);
  }
}
