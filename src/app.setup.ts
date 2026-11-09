import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/http/http-exception.filter';
import { requestContextMiddleware } from './shared/http/request-context.middleware';
import {
  rateLimitMiddleware,
  secureHeadersMiddleware,
} from './shared/http/rate-limit.middleware';

type ApplicationSetupOptions = {
  corsOrigins?: readonly string[];
  rateLimit?: {
    windowMs: number;
    maxRequests: number;
    loginMaxRequests: number;
  };
  trustProxy?: boolean;
};

export function configureApplication(
  app: INestApplication,
  options: ApplicationSetupOptions = {},
): void {
  app.enableShutdownHooks();
  app.use(requestContextMiddleware);
  app.use(secureHeadersMiddleware);
  app.use(
    rateLimitMiddleware(
      options.rateLimit ?? {
        windowMs: 60_000,
        maxRequests: 120,
        loginMaxRequests: 10,
      },
    ),
  );
  if (options.trustProxy === true) {
    const instance = app.getHttpAdapter().getInstance() as {
      set(name: string, value: unknown): void;
    };
    instance.set('trust proxy', 1);
  }

  app.enableCors({
    origin: options.corsOrigins ?? ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Correlation-Id',
      'Idempotency-Key',
    ],
    exposedHeaders: ['X-Correlation-Id'],
  });

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new HttpExceptionFilter());
}

function createSwaggerConfig() {
  return new DocumentBuilder()
    .setTitle('Macromaniacs Backend API')
    .setDescription('Documentação da API do Macromaniacs')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .addTag('health', 'Disponibilidade da aplicação')
    .addTag('auth', 'Cadastro, login e sessão atual')
    .addTag('users', 'Perfil, medidas e métricas nutricionais')
    .addTag('foods', 'Catálogo, cache e consulta de alimentos')
    .addTag('diet-plans', 'Planos alimentares e metas nutricionais')
    .addTag('meals', 'Registro e histórico de refeições consumidas')
    .addTag('progress', 'Snapshots e histórico de progresso nutricional')
    .addTag('gamification', 'Streak, missões, conquistas e pontos')
    .addTag('rewards', 'Catálogo, compras e inventário cosmético')
    .addTag('social', 'Grupos, feed, reações e ranking')
    .build();
}

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}

export function setupSwagger(app: INestApplication): void {
  const documentFactory = () => createSwaggerDocument(app);
  SwaggerModule.setup('docs', app, documentFactory);
}
