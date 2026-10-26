import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication, createSwaggerDocument } from '../src/app.setup';
import { FoodSource } from '../src/integrations/database/entities/enums';
import type {
  FoodProvider,
  ProviderFood,
} from '../src/modules/food-products/domain/food-provider';
import { FoodCacheService } from '../src/modules/food-products/food-cache.service';
import {
  clearFoodData,
  createFoodTestDataSource,
} from './support/food-test-database';

describe('Food cache and manual catalog (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;
  let accessToken: string;

  const manualFood = {
    name: 'Arroz integral cozido',
    barcode: '7891234567890',
    caloriesPer100g: 124,
    proteinPer100g: 2.6,
    carbsPer100g: 25.8,
    fatPer100g: 1,
    fiberPer100g: 2.7,
    servingSizeG: 100,
  };

  beforeAll(async () => {
    database = await createFoodTestDataSource();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();

    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    accessToken = await app
      .get(JwtService)
      .signAsync({ sub: '00000000-0000-4000-8000-000000000001' });
  });

  beforeEach(async () => {
    await clearFoodData(database);
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  it('protege o cadastro manual e publica seu contrato Swagger', async () => {
    await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .send(manualFood)
      .expect(401);

    const document = createSwaggerDocument(app);
    expect(document.paths['/v1/foods/manual']?.post).toBeDefined();
    expect(document.paths['/v1/foods/manual']?.post?.security).toContainEqual({
      'access-token': [],
    });
  });

  it('cadastra alimento manual validado e preserva auditoria', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(manualFood)
      .expect(201);

    expect(response.body).toMatchObject({
      name: manualFood.name,
      source: FoodSource.MANUAL,
      externalId: null,
      barcode: manualFood.barcode,
      caloriesPer100g: 124,
      fiberPer100g: 2.7,
      servingSizeG: 100,
    });
    expect(response.body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(Date.parse(response.body.createdAt)).not.toBeNaN();
    expect(Date.parse(response.body.updatedAt)).not.toBeNaN();

    const [stored] = (await database.query(
      'SELECT source, external_id, barcode FROM "foods"',
    )) as Array<{
      source: string;
      external_id: string | null;
      barcode: string;
    }>;
    expect(stored).toEqual({
      source: FoodSource.MANUAL,
      external_id: null,
      barcode: manualFood.barcode,
    });
  });

  it('rejeita nutrientes inválidos e barcode duplicado', async () => {
    await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...manualFood, caloriesPer100g: -1 })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(manualFood)
      .expect(201);

    await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ ...manualFood, name: 'Outro alimento' })
      .expect(409);
  });

  it('consulta o provedor apenas uma vez e reutiliza o banco local', async () => {
    const food: ProviderFood = {
      externalId: 'off-123',
      name: 'Aveia',
      barcode: '7891234567890',
      basisGrams: '30',
      servingSizeGrams: '30',
      nutrients: {
        caloriesKcal: '114',
        proteinGrams: '3.99',
        carbohydrateGrams: '20.31',
        fatGrams: '2.01',
        fiberGrams: '3.18',
      },
      retrievedAt: new Date('2026-10-18T10:00:00.000Z'),
    };
    let calls = 0;
    const provider: FoodProvider = {
      source: FoodSource.OPEN_FOOD_FACTS,
      search: async () => [food],
      findByBarcode: async () => {
        calls += 1;
        return food;
      },
    };
    const cache = app.get(FoodCacheService);

    const first = await cache.findByBarcode(food.barcode!, provider);
    const second = await cache.findByBarcode(food.barcode!, provider);

    expect(first).toMatchObject({
      cacheHit: false,
      food: {
        source: FoodSource.OPEN_FOOD_FACTS,
        externalId: 'off-123',
        caloriesPer100g: '380.00',
      },
    });
    expect(second).toMatchObject({
      cacheHit: true,
      food: { id: first?.food.id },
    });
    expect(calls).toBe(1);
    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM "foods"',
    )) as Array<{ count: number }>;
    expect(count).toBe(1);
  });
});
