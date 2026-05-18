import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
