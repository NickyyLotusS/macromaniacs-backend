import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import {
  createGamificationTestDataSource,
  resetGamificationData,
} from './support/gamification-test-database';

describe('Gamification ledger and outbox (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

  beforeAll(async () => {
    database = await createGamificationTestDataSource();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  beforeEach(async () => resetGamificationData(database));
  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  it('awards an idempotent capped ledger, mission and first-meal achievement', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'game@example.com',
        username: 'gameuser',
        password: 'strong-password-123',
        termsAccepted: true,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'gameuser', password: 'strong-password-123' })
      .expect(200);
    const token = login.body.accessToken as string;
    const food = await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Arroz',
        caloriesPer100g: 100,
        proteinPer100g: 10,
        carbsPer100g: 20,
        fatPer100g: 2,
        fiberPer100g: 1,
        servingSizeG: 100,
      })
      .expect(201);

    for (let index = 0; index < 4; index += 1) {
      await request(app.getHttpServer())
        .post('/v1/meals/manual')
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', `game-meal-${index}`)
        .send({
          name: `Refeição ${index}`,
          consumedAt: `2026-11-08T${String(10 + index).padStart(2, '0')}:00:00.000Z`,
          items: [{ foodId: food.body.id, amountGrams: 100 }],
        })
        .expect(201);
    }

    const summary = await request(app.getHttpServer())
      .get('/v1/gamification/summary')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(summary.body).toMatchObject({
      currentStreak: 1,
      bestStreak: 1,
      totalPoints: 40,
      lastActivityDate: '2026-11-08',
      scoringVersion: '2026-11-v1',
    });

    const ledger = await request(app.getHttpServer())
      .get('/v1/gamification/ledger')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(ledger.body.meta.totalItems).toBe(5);
    expect(
      ledger.body.items.reduce(
        (total: number, entry: { amount: number }) => total + entry.amount,
        0,
      ),
    ).toBe(40);

    const missions = await request(app.getHttpServer())
      .get('/v1/gamification/missions?date=2026-11-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(missions.body).toContainEqual(
      expect.objectContaining({
        code: 'LOG_THREE_MEALS',
        currentProgress: 3,
        completed: true,
        rewardGranted: true,
      }),
    );
    const achievements = await request(app.getHttpServer())
      .get('/v1/gamification/achievements')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(achievements.body).toContainEqual(
      expect.objectContaining({ code: 'FIRST_MEAL' }),
    );

    await request(app.getHttpServer())
      .post('/v1/gamification/reprocess')
      .set('Authorization', `Bearer ${token}`)
      .expect(201)
      .expect({ processed: 0 });
    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM point_transactions',
    )) as Array<{ count: number }>;
    expect(Number(count)).toBe(5);
  });
});
