import {
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
  ) {
    const userId = req.user!.sub;
    return this.events.updateForUser(userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtCookieGuard)
  async delete(@Req() req: RequestWithUser, @Param('id') id: string) {
    const userId = req.user!.sub;
    return this.events.deleteForUser(userId, id);
  }
}
