// Sentry MUST be the first import so it can instrument Node internals.
import './instrument';
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  // Disable NestJS default logger during bootstrap so we don't get duplicate output.
  // The Pino logger (registered in AppModule) replaces it after the app is created.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  // Security headers (allow Swagger UI inline scripts in dev)
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Consistent error envelope + request ID correlation across all routes
  app.useGlobalFilters(new AllExceptionsFilter());

  app.setGlobalPrefix('v1');

  app.use(cookieParser());
  const origins = (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(
    ',',
  );
  app.enableCors({
    origin: (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void,
    ) => cb(null, !origin || origins.includes(origin)),
    credentials: true,
  });

  // Swagger docs — only in non-production
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Calendar API')
      .setDescription('Google Calendar clone REST API')
      .setVersion('1.0')
      .addCookieAuth('access_token')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('v1/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}

bootstrap().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
