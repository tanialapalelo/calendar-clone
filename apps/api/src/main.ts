import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('v1');

  // Needed so Nest can read req.cookies.access_token
  app.use(cookieParser());

  // Needed so the browser is allowed to send cookies cross-origin (3000 -> 3001)
  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:3000';
  app.enableCors({
    origin: webOrigin,
    credentials: true,
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
