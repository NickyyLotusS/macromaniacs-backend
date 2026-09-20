import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataType, newDb } from 'pg-mem';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import {
  configureApplication,
  createSwaggerDocument,
} from '../src/app.setup';
import { CreateIdentitySchema2026091700000 } from '../src/integrations/database/migrations/2026091700000-create-identity-schema';
import { AddNutritionProfile2026091900000 } from '../src/integrations/database/migrations/2026091900000-add-nutrition-profile';
import { UserProfile } from '../src/modules/auth/entities/user-profile.entity';
import { User } from '../src/modules/auth/entities/user.entity';
import { BodyMeasurement } from '../src/modules/users/entities/body-measurement.entity';
import { UserStat } from '../src/modules/users/entities/user-stat.entity';

const testJwtSecret = 'test-only-jwt-secret-with-at-least-32-characters';

type RegisterPayload = {
  email: string;
  username: string;
  password: string;
  termsAccepted: boolean;
};

describe('Authentication MVP (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

  const validRegistration = (
    suffix = 'user',
  ): RegisterPayload => ({
    email: `${suffix}@example.com`,
    username: suffix,
    password: 'strong-password-123',
    termsAccepted: true,
  });

  const createMemoryDataSource = async (): Promise<DataSource> => {
    const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
    memoryDatabase.public.registerFunction({
      name: 'current_database',
      returns: DataType.text,
      implementation: () => 'macromaniacs_test',
    });
    memoryDatabase.public.registerFunction({
      name: 'version',
      returns: DataType.text,
      implementation: () => 'PostgreSQL 17',
    });
    memoryDatabase.registerExtension('pgcrypto', (schema) => {
      schema.registerFunction({
        name: 'gen_random_uuid',
        returns: DataType.uuid,
        impure: true,
        implementation: randomUUID,
      });
    });

    const dataSource = await memoryDatabase.adapters.createTypeormDataSource({
      type: 'postgres',
      entities: [User, UserProfile, BodyMeasurement, UserStat],
      migrations: [
        CreateIdentitySchema2026091700000,
        AddNutritionProfile2026091900000,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    return dataSource;
  };

  beforeAll(async () => {
    expect(process.env.JWT_SECRET).toBe(testJwtSecret);

    const migrationValidationDatabase = await createMemoryDataSource();
    await migrationValidationDatabase.runMigrations();
    await migrationValidationDatabase.undoLastMigration();
    await migrationValidationDatabase.destroy();

    database = await createMemoryDataSource();
    await database.runMigrations();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();

    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  beforeEach(async () => {
    await database.query('DELETE FROM "user_stats"');
    await database.query('DELETE FROM "body_measurements"');
    await database.query('DELETE FROM "user_profiles"');
    await database.query('DELETE FROM "users"');
  });

  afterAll(async () => {
    await app?.close();

    if (database?.isInitialized) {
      await database.destroy();
    }
  });

  it('returns 200 from health', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('allows the configured React origin through CORS', async () => {
    await request(app.getHttpServer())
      .options('/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .expect('Access-Control-Allow-Origin', 'http://localhost:5173')
      .expect(204);
  });

  it('registers a valid user without sensitive fields', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration())
      .expect(201);

    expect(response.body).toMatchObject({
      email: 'user@example.com',
      username: 'user',
      termsAccepted: true,
    });
    expect(response.body.profile.id).toBeDefined();
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.hash).toBeUndefined();
  });

  it('rejects a duplicate email with 409', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration('first'))
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        ...validRegistration('second'),
        email: 'first@example.com',
      })
      .expect(409);
  });

  it('rejects a duplicate username with 409', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration('duplicate'))
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        ...validRegistration('other'),
        username: 'duplicate',
      })
      .expect(409);
  });

  it('rejects an invalid password with 400', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ ...validRegistration(), password: 'short' })
      .expect(400);
  });

  it('rejects unexpected properties with 400', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({ ...validRegistration(), role: 'admin' })
      .expect(400);
  });

  it('logs in with valid credentials and returns only an access token', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration())
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'user@example.com', password: 'strong-password-123' })
      .expect(200);

    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.hash).toBeUndefined();
  });

  it('returns the same generic 401 for a wrong password', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration())
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'user@example.com', password: 'wrong-password' })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('returns the same generic 401 for an unknown user', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({
        identifier: 'missing@example.com',
        password: 'wrong-password',
      })
      .expect(401);

    expect(response.body.message).toBe('Invalid credentials');
  });

  it('rejects /me without a token', async () => {
    await request(app.getHttpServer()).get('/v1/auth/me').expect(401);
  });

  it('rejects /me with an invalid token', async () => {
    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('rejects /me with an expired token', async () => {
    const jwtService = app.get(JwtService);
    const expiredToken = await jwtService.signAsync(
      { sub: '00000000-0000-0000-0000-000000000000' },
      { expiresIn: -1 },
    );

    await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`)
      .expect(401);
  });

  it('returns the authenticated user from /me without sensitive fields', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(validRegistration())
      .expect(201);

    const loginResponse = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'user', password: 'strong-password-123' })
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/v1/auth/me')
      .set('Authorization', `Bearer ${loginResponse.body.accessToken}`)
      .expect(200);

    expect(response.body.email).toBe('user@example.com');
    expect(response.body.password).toBeUndefined();
    expect(response.body.passwordHash).toBeUndefined();
    expect(response.body.hash).toBeUndefined();
  });

  it('does not expose password hashes in Swagger schemas', () => {
    const document = createSwaggerDocument(app);
    const serializedDocument = JSON.stringify(document);

    expect(serializedDocument).not.toContain('passwordHash');
    expect(serializedDocument).not.toContain('"hash"');
    expect(document.paths['/v1/auth/register']).toBeDefined();
    expect(document.paths['/v1/auth/login']).toBeDefined();
    expect(document.paths['/v1/auth/me']).toBeDefined();
    expect(document.paths['/health']).toBeDefined();
  });
});
