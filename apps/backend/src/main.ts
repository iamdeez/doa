import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // structured stdout logging via nestjs-pino
  app.useLogger(app.get(Logger));

  // global DTO validation (whitelist: strip unknown props, forbidNonWhitelisted: reject unknown)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = process.env['PORT'] ?? 3000;
  await app.listen(port);
}

bootstrap().catch((err: unknown) => {
  console.error('Failed to start application', err);
  process.exit(1);
});
