import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import type { RequestWithUser } from '../auth/auth.types';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @UseGuards(JwtCookieGuard)
  async list(
    @Req() req: RequestWithUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const userId = req.user!.sub;
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;

    return this.events.listForUser(
      userId,
      fromDate && !Number.isNaN(fromDate.getTime()) ? fromDate : undefined,
      toDate && !Number.isNaN(toDate.getTime()) ? toDate : undefined,
    );
  }

  @Post()
  @UseGuards(JwtCookieGuard)
  async create(@Req() req: RequestWithUser, @Body() dto: CreateEventDto) {
    const userId = req.user!.sub;
    return this.events.createForUser(userId, dto);
  }
}
