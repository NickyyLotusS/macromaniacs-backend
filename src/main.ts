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

  configureApplication(app, {
    corsOrigins,
    rateLimit: {
      windowMs: config.get<number>('RATE_LIMIT_WINDOW_MS') ?? 60_000,
      maxRequests: config.get<number>('RATE_LIMIT_MAX') ?? 120,
      loginMaxRequests: config.get<number>('LOGIN_RATE_LIMIT_MAX') ?? 10,
    },
    trustProxy: config.get<boolean>('TRUST_PROXY') === true,
  });

  const appEnv = config.get<string>('APP_ENV') ?? 'development';

  if (appEnv === 'development') {
    setupSwagger(app);
  }

  const port = config.getOrThrow<number>('APP_PORT');

  await app.listen(port, '0.0.0.0');
}

void bootstrap();
