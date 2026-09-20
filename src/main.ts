import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableShutdownHooks();

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  const port = Number(process.env.PORT ?? config.get<number>('APP_PORT') ?? 3000);

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
