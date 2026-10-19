import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication, createSwaggerDocument } from '../src/app.setup';
import { DietPlanStatus } from '../src/integrations/database/entities/enums';
import {
  createDietPlanTestDataSource,
  dietPlanTestUsers,
  resetDietPlanData,
} from './support/diet-plan-test-database';

describe('Diet plans (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;
  let ownerToken: string;
  let strangerToken: string;

  const validPlan = (title = 'Plano principal') => ({
    title,
    targetCalories: 2200,
    targetProtein: 150,
    targetCarbs: 250,
    targetFat: 70,
    targetFiber: 30,
    startDate: '2026-10-20',
    endDate: '2026-11-20',
  });

  const authorized = (token: string) => ({
    Authorization: `Bearer ${token}`,
  });

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
  });

  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  it('protege as rotas e publica parâmetros/respostas no Swagger', async () => {
    await request(app.getHttpServer()).get('/v1/diet-plans').expect(401);

    const document = createSwaggerDocument(app);
    expect(document.paths['/v1/diet-plans']?.get).toBeDefined();
    expect(document.paths['/v1/diet-plans']?.post).toBeDefined();
    expect(document.paths['/v1/diet-plans/{id}/activate']?.post).toBeDefined();
    const parameters = document.paths['/v1/diet-plans']?.get?.parameters ?? [];
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'page' }),
        expect.objectContaining({ name: 'limit' }),
        expect.objectContaining({ name: 'sortBy' }),
        expect.objectContaining({ name: 'sortDirection' }),
        expect.objectContaining({ name: 'status' }),
      ]),
    );
  });

  it('cria rascunho e lista somente planos do usuário com paginação', async () => {
    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan('Plano B'))
      .expect(201)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          title: 'Plano B',
          status: DietPlanStatus.DRAFT,
          targetCalories: 2200,
          targetProtein: 150,
        });
      });

    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan('Plano A'))
      .expect(201);
    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(strangerToken))
      .send(validPlan('Plano alheio'))
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/v1/diet-plans?page=1&limit=1&sortBy=title&sortDirection=asc')
      .set(authorized(ownerToken))
      .expect(200);

    expect(response.body).toEqual({
      items: [expect.objectContaining({ title: 'Plano A' })],
      meta: { page: 1, limit: 1, totalItems: 2, totalPages: 2 },
    });
  });

  it('rejeita período inválido, campos desconhecidos e limites físicos', async () => {
    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send({
        ...validPlan(),
        startDate: '2026-11-20',
        endDate: '2026-10-20',
      })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send({ ...validPlan(), status: DietPlanStatus.ACTIVE })
      .expect(400);

    await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send({ ...validPlan(), targetProtein: 10_000 })
      .expect(400);
  });

  it('atualiza metas sem permitir acesso de outro usuário', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan())
      .expect(201);
    const id = created.body.id as string;

    await request(app.getHttpServer())
      .get(`/v1/diet-plans/${id}`)
      .set(authorized(strangerToken))
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${id}`)
      .set(authorized(strangerToken))
      .send({ targetCalories: 9999 })
      .expect(404);

    await request(app.getHttpServer())
      .patch(`/v1/diet-plans/${id}`)
      .set(authorized(ownerToken))
      .send({ title: 'Plano revisado', targetCalories: 2300, endDate: null })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          id,
          title: 'Plano revisado',
          targetCalories: 2300,
          endDate: null,
        });
      });
  });

  it('ativa transacionalmente um único plano e preserva o histórico', async () => {
    const first = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan('Primeiro'))
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan('Segundo'))
      .expect(201);

    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${first.body.id}/activate`)
      .set(authorized(ownerToken))
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${second.body.id}/activate`)
      .set(authorized(ownerToken))
      .expect(200)
      .expect(({ body }) => {
        expect(body.status).toBe(DietPlanStatus.ACTIVE);
      });

    const rows = (await database.query(
      `SELECT id, status FROM "diet_plans"
       WHERE user_id = $1 ORDER BY title`,
      [dietPlanTestUsers.owner],
    )) as Array<{ id: string; status: DietPlanStatus }>;
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: first.body.id, status: DietPlanStatus.ARCHIVED },
        { id: second.body.id, status: DietPlanStatus.ACTIVE },
      ]),
    );
  });

  it('não altera o plano ativo quando a ativação não pertence ao usuário', async () => {
    const created = await request(app.getHttpServer())
      .post('/v1/diet-plans')
      .set(authorized(ownerToken))
      .send(validPlan())
      .expect(201);
    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${created.body.id}/activate`)
      .set(authorized(ownerToken))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/v1/diet-plans/${created.body.id}/activate`)
      .set(authorized(strangerToken))
      .expect(404);

    const [row] = (await database.query(
      'SELECT status FROM "diet_plans" WHERE id = $1',
      [created.body.id],
    )) as Array<{ status: DietPlanStatus }>;
    expect(row.status).toBe(DietPlanStatus.ACTIVE);
  });
});
