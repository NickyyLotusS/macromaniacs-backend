import { Test } from '@nestjs/testing';
import { jest } from '@jest/globals';
import { Global, Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HealthModule } from '../../src/modules/health/health.module';
import { DATABASE_HEALTH } from '../../src/shared/database/database-health';

describe('Health HTTP', () => {
  let app: INestApplication;
  const database = { isAvailable: jest.fn<() => Promise<boolean>>() };
  beforeAll(async () => {
    @Global()
    @Module({
      providers: [{ provide: DATABASE_HEALTH, useValue: database }],
      exports: [DATABASE_HEALTH],
    })
    class FakeDatabaseModule {}
    const module = await Test.createTestingModule({
      imports: [FakeDatabaseModule, HealthModule],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('liveness não consulta banco', async () => {
    await request(app.getHttpServer()).get('/health').expect(200);
    expect(database.isAvailable).not.toHaveBeenCalled();
  });
  it('readiness consulta PostgreSQL', async () => {
    database.isAvailable.mockResolvedValue(true);
    await request(app.getHttpServer()).get('/health/ready').expect(200);
    database.isAvailable.mockResolvedValue(false);
    await request(app.getHttpServer()).get('/health/ready').expect(503);
  });
});
