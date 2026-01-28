import { Module } from '@nestjs/common';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarsService } from '../calendars/calendars.service';

@Module({
  imports: [PrismaModule],
  controllers: [EventsController],
  providers: [EventsService, CalendarsService],
})
export class EventsModule {}
