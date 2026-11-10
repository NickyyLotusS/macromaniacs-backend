import './setup-env';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module';
import { configureApplication } from '../src/app.setup';
import { MemberRole } from '../src/integrations/database/entities/enums';
import {
  createGamificationTestDataSource,
  resetGamificationData,
} from './support/gamification-test-database';

describe('Social groups, feed and ranking (e2e)', () => {
  let app: INestApplication;
  let database: DataSource;

  const register = async (username: string) => {
    await request(app.getHttpServer())
      .post('/v1/auth/register')
      .send({
        email: `${username}@example.com`,
        username,
        password: 'strong-password-123',
        termsAccepted: true,
      })
      .expect(201);
    const login = await request(app.getHttpServer())
      .post('/v1/auth/login')
      .send({ identifier: username, password: 'strong-password-123' })
      .expect(200);
    return login.body.accessToken as string;
  };

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

  it('isolates private groups, enforces roles and publishes meal events once', async () => {
    const owner = await register('groupowner');
    const member = await register('groupmember');
    const stranger = await register('groupstranger');
    const group = await request(app.getHttpServer())
      .post('/v1/groups')
      .set('Authorization', `Bearer ${owner}`)
      .send({ name: 'Equipe Macro', isPrivate: true })
      .expect(201);
    expect(group.body).toMatchObject({
      role: MemberRole.ADMIN,
      isPrivate: true,
    });

    await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}`)
      .set('Authorization', `Bearer ${stranger}`)
      .expect(404);
    const joined = await request(app.getHttpServer())
      .post('/v1/groups/join')
      .set('Authorization', `Bearer ${member}`)
      .send({ inviteCode: group.body.inviteCode.toLowerCase() })
      .expect(201);
    expect(joined.body.role).toBe(MemberRole.MEMBER);
    const [{ id: memberId }] = (await database.query(
      `SELECT id FROM users WHERE username = 'groupmember'`,
    )) as Array<{ id: string }>;
    await request(app.getHttpServer())
      .patch(`/v1/groups/${group.body.id}/members/${memberId}`)
      .set('Authorization', `Bearer ${stranger}`)
      .send({ role: MemberRole.ADMIN })
      .expect(404);

    const post = await request(app.getHttpServer())
      .post(`/v1/groups/${group.body.id}/feed`)
      .set('Authorization', `Bearer ${owner}`)
      .send({ content: 'Vamos manter o foco!' })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/v1/groups/${group.body.id}/feed/${post.body.id}/reaction`)
      .set('Authorization', `Bearer ${member}`)
      .send({ reactionType: 'FIRE' })
      .expect(200)
      .expect(({ body }) => {
        expect(body.reactions.FIRE).toBe(1);
        expect(body.viewerReaction).toBe('FIRE');
      });

    const food = await request(app.getHttpServer())
      .post('/v1/foods/manual')
      .set('Authorization', `Bearer ${owner}`)
      .send({
        name: 'Banana',
        caloriesPer100g: 90,
        proteinPer100g: 1,
        carbsPer100g: 23,
        fatPer100g: 0.3,
        fiberPer100g: 2.6,
        servingSizeG: 100,
      })
      .expect(201);
    const meal = await request(app.getHttpServer())
      .post('/v1/meals/manual')
      .set('Authorization', `Bearer ${owner}`)
      .set('Idempotency-Key', 'social-meal')
      .send({
        name: 'Lanche',
        consumedAt: new Date().toISOString(),
        items: [{ foodId: food.body.id, amountGrams: 100 }],
      })
      .expect(201);
    const feed = await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/feed`)
      .set('Authorization', `Bearer ${member}`)
      .expect(200);
    expect(feed.body.meta.totalItems).toBe(2);
    expect(feed.body.items).toContainEqual(
      expect.objectContaining({
        mealLogId: meal.body.id,
        userId: expect.any(String),
      }),
    );

    const ranking = await request(app.getHttpServer())
      .get(`/v1/groups/${group.body.id}/ranking`)
      .set('Authorization', `Bearer ${member}`)
      .expect(200);
    expect(ranking.body).toHaveLength(2);
    expect(ranking.body[0]).toMatchObject({
      username: 'groupowner',
      points: 15,
    });
    expect(ranking.body[1]).toMatchObject({
      username: 'groupmember',
      points: 5,
    });
  });
});
