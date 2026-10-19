import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/http/http-exception.filter';
import { requestContextMiddleware } from './shared/http/request-context.middleware';

type ApplicationSetupOptions = {
  corsOrigins?: readonly string[];
};

export function configureApplication(
  app: INestApplication,
  options: ApplicationSetupOptions = {},
): void {
  app.enableShutdownHooks();
  app.use(requestContextMiddleware);

  app.enableCors({
    origin: options.corsOrigins ?? ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Correlation-Id'],
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
    .addTag('diet-plans', 'Planos alimentares e metas nutricionais')
    .build();
}

export function createSwaggerDocument(app: INestApplication): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}

export function setupSwagger(app: INestApplication): void {
  const documentFactory = () => createSwaggerDocument(app);
  SwaggerModule.setup('docs', app, documentFactory);
}
