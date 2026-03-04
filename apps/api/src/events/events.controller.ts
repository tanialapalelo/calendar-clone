import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import type { RequestWithUser } from '../auth/auth.types';
import { UpdateEventDto } from './dto/update-event.dto';

type RecurrenceScope = 'this' | 'following' | 'all';

function parseScope(scope?: string): RecurrenceScope {
  if (!scope) return 'all';
  if (scope === 'this' || scope === 'following' || scope === 'all')
    return scope;
  throw new BadRequestException('Invalid scope');
}

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

    // For recurrence expansion + performance, require a bounded window
    if (!from || !to) {
      throw new BadRequestException('from and to query params are required');
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid from/to');
    }
    if (toDate <= fromDate) {
      throw new BadRequestException('to must be after from');
    }

    // Guardrail: prevent massive windows
    const MAX_WINDOW_DAYS = 180;
    const maxWindowMs = MAX_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    if (toDate.getTime() - fromDate.getTime() > maxWindowMs) {
      throw new BadRequestException(
        `Date range too large (max ${MAX_WINDOW_DAYS} days)`,
      );
    }
    return this.events.listForUser(userId, fromDate, toDate);
  }

  @Post()
  @UseGuards(JwtCookieGuard)
  async create(@Req() req: RequestWithUser, @Body() dto: CreateEventDto) {
    const userId = req.user!.sub;
    return this.events.createForUser(userId, dto);
  }

  @Get(':id')
  @UseGuards(JwtCookieGuard)
  async getOne(@Req() req: RequestWithUser, @Param('id') id: string) {
    return this.events.getForUser(req.user!.sub, id);
  }

  @Patch(':id')
  @UseGuards(JwtCookieGuard)
  async update(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
    @Query('scope') scope?: string,
  ) {
    const userId = req.user!.sub;
    return this.events.updateForUser(userId, id, dto, parseScope(scope));
  }

  @Delete(':id')
  @UseGuards(JwtCookieGuard)
  async delete(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Query('scope') scope?: string,
  ) {
    const userId = req.user!.sub;
    return this.events.deleteForUser(userId, id, parseScope(scope));
  }
}
