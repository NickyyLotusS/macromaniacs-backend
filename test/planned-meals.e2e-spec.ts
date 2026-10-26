import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication, createSwaggerDocument } from '../src/app.setup';
import {
  createDietPlanTestDataSource,
  dietPlanTestUsers,
  resetDietPlanData,
} from './support/diet-plan-test-database';

describe('Planned meals (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;
  let ownerToken: string;
  let strangerToken: string;
  const foodId = '30000000-0000-4000-8000-000000000001';
  const secondFoodId = '30000000-0000-4000-8000-000000000002';

  const authorized = (token: string) => ({ Authorization: `Bearer ${token}` });
  const planPayload = {
    title: 'Plano com refeições',
    targetCalories: 2200,
    targetProtein: 150,
    targetCarbs: 250,
    targetFat: 70,
    targetFiber: 30,
  };

  beforeAll(async () => {
    database = await createDietPlanTestDataSource();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    const jwt = app.get(JwtService);
    ownerToken = await jwt.signAsync({ sub: dietPlanTestUsers.owner });
    strangerToken = await jwt.signAsync({ sub: dietPlanTestUsers.stranger });
  });

  beforeEach(async () => {
    await resetDietPlanData(database);
    await database.query(
      `INSERT INTO "foods"
        ("id", "name", "source", "calories_per_100g", "protein_per_100g",
         "carbs_per_100g", "fat_per_100g", "fiber_per_100g", "serving_size_g")
       VALUES
        ($1, 'Aveia', 'MANUAL', 389, 16.9, 66.3, 6.9, 10.6, 100),
        ($2, 'Banana', 'MANUAL', 89, 1.1, 22.8, 0.3, 2.6, 100)`,
      [foodId, secondFoodId],
    );
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  async function createPlan(token = ownerToken): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(token))
      .send(planPayload)
      .expect(201);
    return response.body.id as string;
  }

  async function createMeal(
    planId: string,
    token = ownerToken,
  ): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(token))
      .send({
        name: 'Café da manhã',
        orderIndex: 1,
        targetCalories: 600,
        targetProtein: 30,
      })
      .expect(201);
    return response.body.id as string;
  }

  it('protege e publica todas as operações no Swagger', async () => {
    const planId = '20000000-0000-4000-8000-000000000001';
    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .expect(401);

    const paths = createSwaggerDocument(app).paths;
    expect(paths['/v1/diet-plans/{planId}/meals']?.get).toBeDefined();
    expect(paths['/v1/diet-plans/{planId}/meals']?.post).toBeDefined();
    expect(
      paths['/v1/diet-plans/{planId}/meals/{mealId}']?.patch,
    ).toBeDefined();
    expect(
      paths['/v1/diet-plans/{planId}/meals/{mealId}']?.delete,
    ).toBeDefined();
    expect(
      paths['/v1/diet-plans/{planId}/meals/{mealId}/items']?.post,
    ).toBeDefined();
    expect(
      paths['/v1/diet-plans/{planId}/meals/{mealId}/items/{itemId}']?.delete,
    ).toBeDefined();
  });

  it('calcula totais do plano e os atualiza após remover um item', async () => {
    const planId = await createPlan();
    const mealId = await createMeal(planId);

    const oats = await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId, amountGrams: 120.5 })
      .expect(201);
    expect(oats.body).toMatchObject({
      amountGrams: 120.5,
      calories: 468.75,
      protein: 20.36,
      carbs: 79.89,
      fat: 8.31,
      fiber: 12.77,
    });

    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId: secondFoodId, amountGrams: 100 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(ownerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals).toEqual({
          calories: 557.75,
          protein: 21.46,
          carbs: 102.69,
          fat: 8.61,
          fiber: 15.37,
        });
        expect(body.meals[0].totals).toEqual(body.totals);
      });

    await request(app.getHttpServer())
      .delete(`/v1/diet-plans/${planId}/meals/${mealId}/items/${oats.body.id}`)
      .set(authorized(ownerToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(ownerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals).toEqual({
          calories: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
          fiber: 2.6,
        });
        expect(body.meals[0].items).toHaveLength(1);
      });
  });

  it('rejeita itens inválidos e ordens duplicadas', async () => {
    const planId = await createPlan();
    const mealId = await createMeal(planId);

    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(ownerToken))
      .send({ name: 'Duplicada', orderIndex: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId, amountGrams: 0 })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({
        foodId: '30000000-0000-4000-8000-000000000099',
        amountGrams: 100,
      })
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${planId}/meals/${mealId}`)
      .set(authorized(ownerToken))
      .send({})
      .expect(400);
  });

  it('oculta plano, refeição e item de outro usuário', async () => {
    const planId = await createPlan();
    const mealId = await createMeal(planId);
    const item = await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId, amountGrams: 100 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(strangerToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${planId}/meals/${mealId}/items/${item.body.id}`)
      .set(authorized(strangerToken))
      .send({ amountGrams: 50 })
      .expect(404);
  });

  it('atualiza refeição e item e remove a refeição com seus itens', async () => {
    const planId = await createPlan();
    const mealId = await createMeal(planId);
    const item = await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId, amountGrams: 100 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${planId}/meals/${mealId}`)
      .set(authorized(ownerToken))
      .send({ name: 'Lanche', orderIndex: 2, targetCalories: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          name: 'Lanche',
          orderIndex: 2,
          targetCalories: null,
        });
        expect(body.items).toHaveLength(1);
      });

    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${planId}/meals/${mealId}/items/${item.body.id}`)
      .set(authorized(ownerToken))
      .send({ foodId: secondFoodId, amountGrams: 50 })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          foodId: secondFoodId,
          amountGrams: 50,
          calories: 44.5,
          carbs: 11.4,
        });
      });

    await request(app.getHttpServer())
      .delete(`/v1/diet-plans/${planId}/meals/${mealId}`)
      .set(authorized(ownerToken))
      .expect(204);
    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(ownerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.meals).toEqual([]);
        expect(body.totals).toEqual({
          calories: 0,
          protein: 0,
          carbs: 0,
          fat: 0,
          fiber: 0,
        });
      });
  });

  it('preserva o snapshot após alteração posterior no alimento', async () => {
    const planId = await createPlan();
    const mealId = await createMeal(planId);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${planId}/meals/${mealId}/items`)
      .set(authorized(ownerToken))
      .send({ foodId, amountGrams: 100 })
      .expect(201);
    await database.query(
      'UPDATE "foods" SET "calories_per_100g" = 999 WHERE "id" = $1',
      [foodId],
    );

    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${planId}/meals`)
      .set(authorized(ownerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.totals.calories).toBe(389);
      });
  });
});
