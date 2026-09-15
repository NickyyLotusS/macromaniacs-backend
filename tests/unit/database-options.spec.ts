import { databaseOptions } from '../../src/integrations/database/database.options';
import type { QueryRunner } from 'typeorm';
import { DefinitiveBaseline1789430400000 } from '../../src/integrations/database/migrations/1789430400000-DefinitiveBaseline';
import {
  validate,
  validateDatabaseUrl,
} from '../../src/shared/config/env.validation';

describe('Configuração de banco', () => {
  it('bloqueia revert destrutivo da baseline fora de banco descartável', async () => {
    let calls = 0;
    const runner = {
      query: async () => {
        calls++;
        return [{ database: 'macromaniacs_db' }];
      },
    } as unknown as QueryRunner;
    await expect(
      new DefinitiveBaseline1789430400000().down(runner),
    ).rejects.toThrow('destrutivo');
    expect(calls).toBe(1);
  });
  it('carrega 23 entidades e só a baseline, sem mutações automáticas', () => {
    const options = databaseOptions(
      'postgresql://user:example@localhost:5433/example',
    );
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(options.entities).toHaveLength(23);
    expect(options.migrations).toHaveLength(1);
    expect(options).toHaveProperty('installExtensions', false);
  });
  it.each([
    '',
    'mysql://user@example.com/db',
    'postgresql://localhost/db',
    'postgresql://user@localhost/',
  ])('rejeita URL incompleta %s', (url) => {
    expect(() => validateDatabaseUrl(url)).toThrow();
  });
  it('valida ambiente, porta e normaliza whitespace da URL sem logar segredos', () => {
    expect(
      validate({ DATABASE_URL: ' postgresql://user@localhost/db ' }),
    ).toHaveProperty('DATABASE_URL', 'postgresql://user@localhost/db');
    expect(() =>
      validate({ DATABASE_URL: 'postgresql://user@localhost/db', APP_PORT: 0 }),
    ).toThrow();
    expect(() =>
      validate({
        DATABASE_URL: 'postgresql://user@localhost/db',
        APP_ENV: 'invalid',
      }),
    ).toThrow();
  });
});
