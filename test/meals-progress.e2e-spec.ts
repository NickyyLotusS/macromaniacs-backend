import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import {
  createMealTestDataSource,
  resetMealData,
} from './support/meal-test-database';

describe('Consumed meals and nutrition progress (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

  const register = async (name: string): Promise<string> => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `${name}@example.com`,
        username: name,
        password: 'strong-password-123',
        termsAccepted: true,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: name, password: 'strong-password-123' })
      .expect(200);
    return login.body.accessToken as string;
  };

  const createFood = async (token: string, name: string) => {
    const response = await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name,
        caloriesPer100g: 200,
        proteinPer100g: 10,
        carbsPer100g: 20,
        fatPer100g: 5,
        fiberPer100g: 4,
        servingSizeG: 100,
      })
      .expect(201);
    return response.body.id as string;
  };

  beforeAll(async () => {
    database = await createMealTestDataSource();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  beforeEach(async () => resetMealData(database));
  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  it('creates a manual meal atomically and deduplicates a retried request', async () => {
    const token = await register('mealowner');
    const foodId = await createFood(token, 'Arroz');
    const payload = {
      name: 'Almoço',
      consumedAt: '2026-11-08T15:00:00.000Z',
      items: [{ foodId, amountGrams: 150 }],
    };
    const first = await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'manual-1')
      .send(payload)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'manual-1')
      .send(payload)
      .expect(201);

    expect(retry.body.id).toBe(first.body.id);
    expect(first.body.totals).toEqual({
      calories: 300,
      protein: 15,
      carbs: 30,
      fat: 7.5,
      fiber: 6,
    });
    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM meal_logs WHERE deleted_at IS NULL',
    )) as Array<{ count: number }>;
    expect(Number(count)).toBe(1);

    const progress = await request(app.getHttpServer())
      .get('/v1/progress/daily?date=2026-11-08')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(progress.body).toMatchObject({ calories: 300, mealCount: 1 });
  });

  it('rolls back the whole meal when one item is invalid', async () => {
    const token = await register('rollbackmeal');
    const foodId = await createFood(token, 'Feijão');
    await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'invalid-item')
      .send({
        name: 'Almoço',
        items: [
          { foodId, amountGrams: 100 },
          { foodId: randomUUID(), amountGrams: 100 },
        ],
      })
      .expect(404);
    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM meal_logs',
    )) as Array<{ count: number }>;
    expect(Number(count)).toBe(0);
  });

  it('checks in a planned meal from immutable nutrition snapshots without duplication', async () => {
    const token = await register('plannedcheckin');
    const foodId = await createFood(token, 'Frango');
    const plan = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Plano check-in',
        targetCalories: 2000,
        targetProtein: 150,
        targetCarbs: 200,
        targetFat: 60,
      })
      .expect(201);
    const planned = await request(app.getHttpServer())
      .post(`/v1/diet-plans/${plan.body.id}/meals`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Almoço', orderIndex: 1, scheduledTime: '12:30' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${plan.body.id}/meals/${planned.body.id}/items`)
      .set('Authorization', `Bearer ${token}`)
      .send({ foodId, amountGrams: 200 })
      .expect(201);

    const payload = {
      plannedMealId: planned.body.id,
      consumedAt: '2026-11-09T15:30:00.000Z',
    };
    const first = await request(app.getHttpServer())
      .post('/v1/meals/check-in')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'planned-check-in')
      .send(payload)
      .expect(201);
    const retry = await request(app.getHttpServer())
      .post('/v1/meals/check-in')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'planned-check-in')
      .send(payload)
      .expect(201);
    expect(retry.body.id).toBe(first.body.id);
    expect(first.body).toMatchObject({
      plannedMealId: planned.body.id,
      totals: { calories: 400, protein: 20, carbs: 40, fat: 10, fiber: 8 },
    });
  });

  it('uses the profile IANA timezone for food-day boundaries', async () => {
    const token = await register('timezoneuser');
    await request(app.getHttpServer())
      .patch('/v1/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ timezone: 'America/Sao_Paulo' })
      .expect(200);
    const foodId = await createFood(token, 'Iogurte');
    const meal = await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'day-boundary')
      .send({
        name: 'Ceia',
        consumedAt: '2026-11-09T02:30:00.000Z',
        items: [{ foodId, amountGrams: 100 }],
      })
      .expect(201);
    expect(meal.body).toMatchObject({
      foodDate: '2026-11-08',
      timezone: 'America/Sao_Paulo',
    });
  });

  it('isolates ownership and recalculates after update and soft deletion', async () => {
    const owner = await register('mealowner2');
    const stranger = await register('mealstranger');
    const foodId = await createFood(owner, 'Aveia');
    const created = await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${owner}`)
      .set('Idempotency-Key', 'owned-meal')
      .send({
        name: 'Café',
        consumedAt: '2026-11-08T10:00:00.000Z',
        items: [{ foodId, amountGrams: 100 }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(`/v1/meals/${created.body.id}`)
      .set('Authorization', `Bearer ${stranger}`)
      .expect(404);
    const updated = await request(app.getHttpServer())
      .patch(`/v1/meals/${created.body.id}`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ items: [{ foodId, amountGrams: 200 }] })
      .expect(200);
    expect(updated.body.totals.calories).toBe(400);
    await request(app.getHttpServer())
      .delete(`/v1/meals/${created.body.id}`)
      .set('Authorization', `Bearer ${owner}`)
      .expect(204);
    const progress = await request(app.getHttpServer())
      .get('/v1/progress/daily?date=2026-11-08')
      .set('Authorization', `Bearer ${owner}`)
      .expect(200);
    expect(progress.body).toMatchObject({ calories: 0, mealCount: 0 });
  });
});
