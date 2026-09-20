import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApplication, setupSwagger } from './app.setup';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  const corsOrigins = (config.get<string>('CORS_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  configureApplication(app, { corsOrigins });

  const appEnv = config.get<string>('APP_ENV') ?? 'development';

  if (appEnv === 'development') {
    setupSwagger(app);
  }

  const port = config.get<number>('APP_PORT') ?? 3000;

  await app.listen(port);
}

void bootstrap();
