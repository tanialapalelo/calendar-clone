import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CalendarsModule } from './calendars/calendars.module';
import { EventsModule } from './events/events.module';

@Module({
  imports: [PrismaModule, AuthModule, CalendarsModule, EventsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
