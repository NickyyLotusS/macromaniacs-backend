import { Body, Controller, Get, Module, Post } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsString } from 'class-validator';
import request from 'supertest';
import { configureApplication } from '../../src/app.setup';

class ReferenceDto {
  @IsString()
  name!: string;
}

@Controller({ path: 'contract-test', version: '1' })
class ContractController {
  @Post()
  echo(@Body() body: ReferenceDto): ReferenceDto {
    return body;
  }

  @Get('unexpected-error')
  fail(): never {
    throw new Error('secret database detail');
  }
}

@Module({ controllers: [ContractController] })
class ContractModule {}

describe('Contrato HTTP global', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [ContractModule],
    }).compile();
    app = module.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => app.close());

  it('rejeita propriedades desconhecidas e devolve correlation ID', async () => {
    const response = await request(app.getHttpServer())
      .post('/v1/contract-test')
      .set('x-correlation-id', 'client-request-123')
      .send({ name: 'Macro', role: 'admin' })
      .expect(400)
      .expect('x-correlation-id', 'client-request-123');

    expect(response.body).toMatchObject({
      statusCode: 400,
      path: '/v1/contract-test',
      correlationId: 'client-request-123',
    });
  });

  it('não expõe stack trace nem mensagem interna em erros 500', async () => {
    const response = await request(app.getHttpServer())
      .get('/v1/contract-test/unexpected-error')
      .set('x-correlation-id', 'invalid value with spaces')
      .expect(500);

    expect(response.headers['x-correlation-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f-]{27}$/,
    );
    expect(response.body.message).toBe('Internal server error');
    expect(JSON.stringify(response.body)).not.toContain(
      'secret database detail',
    );
    expect(JSON.stringify(response.body)).not.toContain('stack');
  });
});
