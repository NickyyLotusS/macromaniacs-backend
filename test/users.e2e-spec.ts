import type { INestApplication } from '@nestjs/common';
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

type Registration = {
  email: string;
  username: string;
  password: string;
  termsAccepted: true;
};

describe('Users profile and onboarding (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

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

  const registration = (name: string): Registration => ({
    email: `${name}@example.com`,
    username: name,
    password: 'strong-password-123',
    termsAccepted: true,
  });

  const registerAndLogin = async (name: string): Promise<string> => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send(registration(name))
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: name, password: 'strong-password-123' })
      .expect(200);
    return login.body.accessToken as string;
  };

  const validOnboarding = () => ({
    displayName: 'Macro User',
    dateOfBirth: '1996-09-19',
    heightCm: 180,
    currentWeightKg: 80,
    biologicalSex: 'MALE',
    goal: 'LOSE_WEIGHT',
    activityLevel: 'MODERATE',
    targetWeightKg: 75,
    targetDate: '2027-03-01',
    dietaryRestrictions: 'Sem lactose',
  });

  beforeAll(async () => {
    const migrationDatabase = await createMemoryDataSource();
    await migrationDatabase.runMigrations();
    await migrationDatabase.undoLastMigration();
    await migrationDatabase.destroy();

    database = await createMemoryDataSource();
    await database.runMigrations();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
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
    if (database?.isInitialized) await database.destroy();
  });

  it('rejects profile access without a token', async () => {
    await request(app.getHttpServer()).get('/v1/users/me').expect(401);
  });

  it('returns a newly registered existing-compatible user as incomplete', async () => {
    const token = await registerAndLogin('incomplete');
    const response = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(response.body).toMatchObject({
      username: 'incomplete',
      onboardingCompleted: false,
      currentMeasurement: null,
      measurements: [],
      nutrition: null,
    });
  });

  it('completes onboarding, persists data and returns calculated metrics', async () => {
    const token = await registerAndLogin('complete');
    const update = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(validOnboarding())
      .expect(200);

    expect(update.body.onboardingCompleted).toBe(true);
    expect(update.body.onboardingCompletedAt).toEqual(expect.any(String));
    expect(update.body.currentMeasurement).toMatchObject({
      heightCm: 180,
      weightKg: 80,
    });
    expect(update.body.nutrition).toMatchObject({
      bmrKcalPerDay: expect.any(Number),
      tdeeKcalPerDay: expect.any(Number),
      calorieTargetKcalPerDay: expect.any(Number),
    });

    const persisted = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(persisted.body).toEqual(update.body);
  });

  it.each([
    ['unexpected property', { ...validOnboarding(), userId: randomUUID() }],
    ['invalid enum', { ...validOnboarding(), goal: 'CRASH_DIET' }],
    ['invalid weight', { ...validOnboarding(), currentWeightKg: -1 }],
    ['invalid height', { ...validOnboarding(), heightCm: 0 }],
    ['invalid birth date', { ...validOnboarding(), dateOfBirth: '2030-01-01' }],
    [
      'past target date',
      {
        ...validOnboarding(),
        goal: 'MAINTAIN',
        targetWeightKg: 80,
        targetDate: '2020-01-01',
      },
    ],
  ])('rejects %s with 400', async (_name, payload) => {
    const token = await registerAndLogin(`invalid${Math.random()}`.replace('.', ''));
    await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(payload)
      .expect(400);
  });

  it('updates only the authenticated user and rejects a supplied userId', async () => {
    const firstToken = await registerAndLogin('ownerone');
    const secondToken = await registerAndLogin('ownertwo');
    const secondProfile = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${firstToken}`)
      .send({ ...validOnboarding(), userId: secondProfile.body.id })
      .expect(400);

    const unchanged = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${secondToken}`)
      .expect(200);
    expect(unchanged.body.onboardingCompleted).toBe(false);
  });

  it('preserves measurement history and recalculates after weight changes', async () => {
    const token = await registerAndLogin('history');
    const first = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send(validOnboarding())
      .expect(200);
    const changed = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentWeightKg: 70 })
      .expect(200);

    expect(changed.body.measurements).toHaveLength(2);
    expect(changed.body.currentMeasurement.weightKg).toBe(70);
    expect(changed.body.nutrition.bmrKcalPerDay).toBe(
      first.body.nutrition.bmrKcalPerDay - 100,
    );
  });

  it('recalculates TDEE after activity changes', async () => {
    const token = await registerAndLogin('activity');
    const first = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validOnboarding(), activityLevel: 'SEDENTARY' })
      .expect(200);
    const changed = await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ activityLevel: 'INTENSE' })
      .expect(200);

    expect(changed.body.nutrition.tdeeKcalPerDay).toBeGreaterThan(
      first.body.nutrition.tdeeKcalPerDay,
    );
  });

  it('never returns password fields and publishes the Users Swagger contract', async () => {
    const token = await registerAndLogin('safeprofile');
    const response = await request(app.getHttpServer())
      .get('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const serialized = JSON.stringify(response.body);

    expect(serialized).not.toContain('password');
    expect(serialized).not.toContain('hash');

    const document = createSwaggerDocument(app);
    expect(document.paths['/v1/users/me']?.get).toBeDefined();
    expect(document.paths['/v1/users/me']?.patch).toBeDefined();
    expect(JSON.stringify(document)).not.toContain('passwordHash');
  });
});
