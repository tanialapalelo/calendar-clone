import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CalendarsModule } from '../calendars/calendars.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [PrismaModule, CalendarsModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
