import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { OpenAPIObject } from '@nestjs/swagger';
import { HttpExceptionFilter } from './shared/http/http-exception.filter';

type ApplicationSetupOptions = {
  corsOrigins?: readonly string[];
};

export function configureApplication(
  app: INestApplication,
  options: ApplicationSetupOptions = {},
): void {
  app.enableShutdownHooks();

  app.enableCors({
    origin: options.corsOrigins ?? ['http://localhost:5173'],
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
    .build();
}

export function createSwaggerDocument(
  app: INestApplication,
): OpenAPIObject {
  return SwaggerModule.createDocument(app, createSwaggerConfig());
}

export function setupSwagger(app: INestApplication): void {
  const documentFactory = () => createSwaggerDocument(app);
  SwaggerModule.setup('docs', app, documentFactory);
}
