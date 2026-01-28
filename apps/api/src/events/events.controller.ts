import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import type { AuthUser } from '../auth/auth.types';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@Controller('events')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Get()
  @UseGuards(JwtCookieGuard)
  async list(
    @Req() req: Request & { user?: AuthUser },
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
  async create(
    @Req() req: Request & { user?: AuthUser },
    @Body() dto: CreateEventDto,
  ) {
    const userId = req.user!.sub;
    return this.events.createForUser(userId, dto);
  }
}
