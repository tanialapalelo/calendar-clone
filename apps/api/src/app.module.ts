import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { CalendarsModule } from './calendars/calendars.module';
import { EventsModule } from './events/events.module';
import { MailerModule } from './mailer/mailer.module';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware';

@Module({
  imports: [
    // Structured JSON logging via Pino.
    // In development, pino-pretty formats output for human readability.
    // In production, raw JSON is emitted so log aggregators (Datadog, CloudWatch)
    // can parse and index fields like requestId, statusCode, responseTime.
    LoggerModule.forRoot({
      pinoHttp: {
        // Attach the request ID (set by RequestIdMiddleware) to every log line.
        // Cast to any because nestjs-pino's IncomingMessage type doesn't include
        // our custom `id` property — the value is always set by the middleware.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        genReqId: (req: any) => (req.id as string) ?? '',
        // Redact sensitive headers from logs
        redact: ['req.headers.authorization', 'req.headers.cookie'],
        // Don't log favicon or health check noise
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        autoLogging: { ignore: (req: any) => req.url === '/v1/health' },
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { colorize: true, singleLine: true } }
            : undefined,
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
      },
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    PrismaModule,
    AuthModule,
    CalendarsModule,
    EventsModule,
    MailerModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestIdMiddleware must run before Pino so genReqId can read req.id
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
