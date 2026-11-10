import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import {
  createRewardsTestDataSource,
  resetRewardsData,
} from './support/rewards-test-database';

describe('Rewards store and inventory (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

  beforeAll(async () => {
    database = await createRewardsTestDataSource();
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(getDataSourceToken())
      .useValue(database)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });
  beforeEach(async () => resetRewardsData(database));
  afterAll(async () => {
    await app?.close();
    if (database?.isInitialized) await database.destroy();
  });

  it('buys atomically, deduplicates retries and equips one item per type', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'shop@example.com',
        username: 'shopuser',
        password: 'strong-password-123',
        termsAccepted: true,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'shopuser', password: 'strong-password-123' })
      .expect(200);
    const token = login.body.accessToken as string;
    const [{ id: userId }] = (await database.query(
      `SELECT id FROM users WHERE username = 'shopuser'`,
    )) as Array<{ id: string }>;
    await database.query(
      `INSERT INTO point_transactions
        (id, user_id, amount, reason, metadata, idempotency_key, source_type)
       VALUES ($1, $2, 150, 'ADMIN_ADJUSTMENT', '{}', 'test-credit', 'test')`,
      [randomUUID(), userId],
    );
    const catalog = await request(app.getHttpServer())
      .get('/v1/rewards/catalog')
      .expect(200);
    const firstId = catalog.body[0].id as string;
    const secondId = catalog.body[1].id as string;

    const first = await request(app.getHttpServer())
      .post(`/v1/rewards/purchases/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'purchase-one')
      .expect(201);
    expect(first.body.balance).toBe(100);
    const retry = await request(app.getHttpServer())
      .post(`/v1/rewards/purchases/${firstId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'purchase-one')
      .expect(201);
    expect(retry.body).toMatchObject({
      balance: 100,
      item: { id: firstId },
    });

    await request(app.getHttpServer())
      .post(`/v1/rewards/purchases/${secondId}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', 'purchase-two')
      .expect(201)
      .expect(({ body }) => expect(body.balance).toBe(25));
    await request(app.getHttpServer())
      .put(`/v1/rewards/inventory/${firstId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    await request(app.getHttpServer())
      .put(`/v1/rewards/inventory/${secondId}/equip`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const inventory = await request(app.getHttpServer())
      .get('/v1/rewards/inventory')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(
      inventory.body.filter((item: { isEquipped: boolean }) => item.isEquipped),
    ).toHaveLength(1);
    expect(inventory.body).toContainEqual(
      expect.objectContaining({ id: secondId, isEquipped: true }),
    );
    const [{ debits }] = (await database.query(
      `SELECT count(*)::int AS debits FROM point_transactions
       WHERE reason = 'COSMETIC_PURCHASE'`,
    )) as Array<{ debits: number }>;
    expect(Number(debits)).toBe(2);
  });

  it('does not grant inventory when balance is insufficient', async () => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: 'poor@example.com',
        username: 'pooruser',
        password: 'strong-password-123',
        termsAccepted: true,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: 'pooruser', password: 'strong-password-123' })
      .expect(200);
    const catalog = await request(app.getHttpServer())
      .get('/v1/rewards/catalog')
      .expect(200);
    await request(app.getHttpServer())
      .post(`/v1/rewards/purchases/${catalog.body[0].id}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .set('Idempotency-Key', 'insufficient')
      .expect(409);
    const [{ count }] = (await database.query(
      'SELECT count(*)::int AS count FROM user_cosmetics',
    )) as Array<{ count: number }>;
    expect(Number(count)).toBe(0);
  });
});
