import 'reflect-metadata';
import { jest } from '@jest/globals';
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DatabaseSource } from '../../src/integrations/database/database-source';
import { databaseOptions } from '../../src/integrations/database/database.options';
import { seedCatalogs } from '../../src/integrations/database/catalog-seed';
import { assertPhysicalChecksMapped } from '../../src/integrations/database/check-mapping';
import {
  assertSchemaParity,
  inspectSchema,
} from '../../src/integrations/database/schema-inspection';
import { User } from '../../src/integrations/database/entities/identity/user.entity';
import { UserProfile } from '../../src/integrations/database/entities/identity/user-profile.entity';
import {
  ActivityLevel,
  BiologicalSex,
  UserGoal,
} from '../../src/integrations/database/entities/enums';
import { baselinePreflight } from '../../scripts/baseline-preflight';
import { BASELINE_NAME } from '../../src/integrations/database/migrations/1789430400000-DefinitiveBaseline';

jest.setTimeout(60000);

describe('PostgreSQL: Prisma × TypeORM em bancos descartáveis', () => {
  let admin: DataSource;
  let empty: DatabaseSource;
  let legacy: DatabaseSource;
  let emptyUrl: string;
  const sql = (path: string) =>
    readFileSync(resolve(path), 'utf8').replace(/^\\set.*$/gm, '');

  async function dataFingerprint(source: DataSource): Promise<string> {
    const snapshot = await inspectSchema(source);
    const hash = createHash('sha256');
    for (const table of snapshot.tables) {
      const name = String(table.name);
      if (!/^[a-z_]+$/.test(name))
        throw new Error('Tabela inesperada no teste.');
      const rows = await source.query(
        `SELECT to_jsonb(t)::text AS row FROM public."${name}" t ORDER BY to_jsonb(t)::text`,
      );
      hash.update(name).update(JSON.stringify(rows));
    }
    return hash.digest('hex');
  }

  async function catalogs(source: DataSource) {
    const result: Record<string, unknown> = {};
    for (const table of ['achievements', 'daily_missions', 'cosmetic_items'])
      result[table] = await source.query(
        `SELECT id,code FROM public.${table} ORDER BY code`,
      );
    return result;
  }

  beforeAll(async () => {
    const value = process.env.TEST_ADMIN_DATABASE_URL;
    if (!value)
      throw new Error(
        'TEST_ADMIN_DATABASE_URL é obrigatória e deve apontar para um servidor PostgreSQL descartável separado.',
      );
    const url = new URL(value);
    if (decodeURIComponent(url.pathname) !== '/validation')
      throw new Error(
        'O banco administrativo de testes deve se chamar validation.',
      );
    if (process.env.DATABASE_URL) {
      const real = new URL(process.env.DATABASE_URL);
      if (
        real.hostname === url.hostname &&
        (real.port || '5432') === (url.port || '5432')
      )
        throw new Error('Use servidor isolado, não o PostgreSQL real.');
    }
    admin = new DataSource({
      type: 'postgres',
      url: value,
      synchronize: false,
      migrationsRun: false,
      installExtensions: false,
    });
    await admin.initialize();
    const suffix = `${Date.now()}_${randomUUID().slice(0, 8)}`;
    const emptyName = `macromaniacs_test_empty_${suffix}`;
    const legacyName = `macromaniacs_test_legacy_${suffix}`;
    await admin.query(`CREATE DATABASE "${emptyName}"`);
    await admin.query(`CREATE DATABASE "${legacyName}"`);
    url.pathname = `/${emptyName}`;
    emptyUrl = url.toString();
    empty = new DatabaseSource(databaseOptions(emptyUrl));
    url.pathname = `/${legacyName}`;
    legacy = new DatabaseSource(databaseOptions(url.toString()));
    await empty.initialize();
    await legacy.initialize();
    console.log(
      `Bancos descartáveis preservados para inspeção: ${emptyName}, ${legacyName}`,
    );
  });

  afterAll(async () => {
    // Never drop a database automatically; the isolated cluster is cleaned only with authorization.
    for (const source of [empty, legacy, admin])
      if (source?.isInitialized) await source.destroy();
  });

  it('A: baseline cria 23 tabelas, 11 enums, 55 índices e 50 CHECKs; seed é idempotente', async () => {
    const applied = await empty.runMigrations({ transaction: 'all' });
    expect(applied.map((migration) => migration.name)).toEqual([BASELINE_NAME]);
    assertSchemaParity(await inspectSchema(empty));
    await seedCatalogs(empty);
    const first = await catalogs(empty);
    await empty.query(
      "UPDATE achievements SET title='Stale label' WHERE code='FIRST_MEAL'",
    );
    await seedCatalogs(empty);
    expect(await catalogs(empty)).toEqual(first);
    expect(
      await empty.query(
        "SELECT title FROM achievements WHERE code='FIRST_MEAL'",
      ),
    ).toEqual([{ title: 'Primeiro Prato' }]);
    expect(first.achievements).toHaveLength(4);
    expect(first.daily_missions).toHaveLength(3);
    expect(first.cosmetic_items).toHaveLength(3);
  });

  it('B: histórico Prisma, dados legados e baseline --fake preservam schema e todos os registros', async () => {
    const directory = resolve('legacy/prisma/migrations');
    const names = readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    for (const name of names.slice(0, 3))
      await legacy.query(sql(`legacy/prisma/migrations/${name}/migration.sql`));
    await legacy.query(sql('tests/fixtures/catalogs-before-alignment.sql'));
    await legacy.query(sql('legacy/prisma/legacy-migration-fixture.sql'));
    await legacy.query(
      sql(`legacy/prisma/migrations/${names[3]}/migration.sql`),
    );
    await legacy.query(`CREATE TABLE public._prisma_migrations(id VARCHAR(36) PRIMARY KEY,checksum VARCHAR(64) NOT NULL,
      finished_at TIMESTAMPTZ,migration_name VARCHAR(255) NOT NULL,logs TEXT,rolled_back_at TIMESTAMPTZ,
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),applied_steps_count INTEGER NOT NULL DEFAULT 0)`);
    for (const name of names)
      await legacy.query(
        'INSERT INTO public._prisma_migrations(id,checksum,migration_name,finished_at,applied_steps_count) VALUES($1,$2,$3,now(),1)',
        [
          randomUUID(),
          createHash('sha256')
            .update(readFileSync(resolve(directory, name, 'migration.sql')))
            .digest('hex'),
          name,
        ],
      );
    const beforeSchema = await inspectSchema(legacy);
    assertSchemaParity(beforeSchema, await inspectSchema(empty));
    expect(await baselinePreflight(legacy)).toBe(false);
    const before = await dataFingerprint(legacy);
    await legacy.runMigrations({ fake: true, transaction: 'all' });
    expect(await dataFingerprint(legacy)).toBe(before);
    assertSchemaParity(await inspectSchema(legacy), beforeSchema);
    expect(await baselinePreflight(legacy)).toBe(true);
    expect(await legacy.runMigrations({ transaction: 'all' })).toEqual([]);
    const first = await catalogs(legacy);
    await seedCatalogs(legacy);
    await seedCatalogs(legacy);
    expect(await catalogs(legacy)).toEqual(first);
    expect(first.achievements).toHaveLength(4);
    expect(first.daily_missions).toHaveLength(3);
    expect(first.cosmetic_items).toHaveLength(3);
    expect(
      await legacy.query(
        "SELECT reason,metadata->>'referenceType' AS reference_type FROM point_transactions WHERE id='76000000-0000-0000-0000-000000000001'",
      ),
    ).toEqual([
      { reason: 'DAILY_MISSION_COMPLETED', reference_type: 'DAILY_MISSION' },
    ]);
    expect(
      await legacy.query(
        "SELECT creator_id FROM groups WHERE id='72000000-0000-0000-0000-000000000001'",
      ),
    ).toEqual([{ creator_id: '70000000-0000-0000-0000-000000000001' }]);
  });

  it('verifica paridade de entidades e zero SQL gerado, sem omitir checks ou índices DESC', async () => {
    for (const source of [empty, legacy]) {
      assertSchemaParity(await inspectSchema(source));
      await assertPhysicalChecksMapped(source);
      expect(
        (await source.driver.createSchemaBuilder().log()).upQueries,
      ).toEqual([]);
    }
    const metadata = empty.getMetadata(UserProfile);
    expect(metadata.findColumnWithPropertyName('birthDate')?.isNullable).toBe(
      false,
    );
    expect(
      metadata.findColumnWithPropertyName('goal')?.default,
    ).toBeUndefined();
    expect(
      empty
        .getMetadata(User)
        .relations.find((relation) => relation.propertyName === 'profile')
        ?.isOneToOne,
    ).toBe(true);
    const email = empty.getMetadata(User).findColumnWithPropertyName('email')!;
    const check = empty.getMetadata(User).checks[0];
    const expression = check.expression;
    try {
      check.expression = 'true';
      await expect(assertPhysicalChecksMapped(empty)).rejects.toThrow(
        'CHECK alterado',
      );
    } finally {
      check.expression = expression;
    }
    const length = email.length;
    try {
      email.length = '254';
      expect(
        (await empty.driver.createSchemaBuilder().log()).upQueries.length,
      ).toBeGreaterThan(0);
    } finally {
      email.length = length;
    }
    assertSchemaParity(await inspectSchema(empty));
  });

  it('executa os testes SQL completos nos dois cenários e não deixa dados de teste', async () => {
    for (const source of [empty, legacy]) {
      const before = await dataFingerprint(source);
      await source.query(sql('tests/sql/integrity.sql'));
      expect(await dataFingerprint(source)).toBe(before);
    }
  });

  it('CRUD TypeORM preserva UUIDs, DATE, TIMESTAMPTZ, JSONB, decimais string e perfil opcional', async () => {
    const repository = empty.getRepository(User);
    const user = await repository.save(
      repository.create({
        email: 'typeorm@example.com',
        passwordHash: 'test-hash',
        username: 'typeorm_user',
        displayName: 'TypeORM User',
      }),
    );
    expect(user.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(
      (
        await repository.findOneOrFail({
          where: { id: user.id },
          relations: { profile: true },
        })
      ).profile,
    ).toBeNull();
    await empty.getRepository(UserProfile).save({
      userId: user.id,
      birthDate: '1990-01-01',
      biologicalSex: BiologicalSex.NOT_INFORMED,
      heightCm: '175.25',
      currentWeightKg: '75.50',
      goal: UserGoal.RECOMPOSITION,
      activityLevel: ActivityLevel.MODERATE,
      avatarConfig: { test: true },
    });
    const profile = await empty
      .getRepository(UserProfile)
      .findOneByOrFail({ userId: user.id });
    expect(profile.birthDate).toBe('1990-01-01');
    expect(profile.currentWeightKg).toBe('75.50');
    expect(profile.heightCm).toBe('175.25');
    expect(profile.avatarConfig).toEqual({ test: true });
    const original = profile.updatedAt;
    await empty
      .getRepository(UserProfile)
      .update({ userId: user.id }, { currentWeightKg: '76.00' });
    expect(
      (
        await empty
          .getRepository(UserProfile)
          .findOneByOrFail({ userId: user.id })
      ).updatedAt.getTime(),
    ).toBeGreaterThanOrEqual(original.getTime());
    await repository.delete({ id: user.id });
    expect(
      await empty.getRepository(UserProfile).findOneBy({ userId: user.id }),
    ).toBeNull();
  });

  it('preflight rejeita schema divergente, histórico falho e controle TypeORM desconhecido', async () => {
    await legacy.query(
      'ALTER TABLE users ADD CONSTRAINT unmapped_test_check CHECK (length(email)>0)',
    );
    await expect(assertPhysicalChecksMapped(legacy)).rejects.toThrow(
      'não representado',
    );
    await legacy.query('ALTER TABLE users DROP CONSTRAINT unmapped_test_check');
    await legacy.query('ALTER TABLE users ADD COLUMN unexpected_test TEXT');
    await expect(baselinePreflight(legacy)).rejects.toThrow('Divergência');
    await legacy.query('ALTER TABLE users DROP COLUMN unexpected_test');
    await legacy.query(
      'UPDATE _prisma_migrations SET rolled_back_at=now() WHERE migration_name=$1',
      ['20260828205714_init_schema_and_tables'],
    );
    await expect(baselinePreflight(legacy)).rejects.toThrow('Histórico');
    await legacy.query('UPDATE _prisma_migrations SET rolled_back_at=NULL');
    await legacy.query('INSERT INTO migrations(timestamp,name) VALUES(1,$1)', [
      'UnknownMigration1',
    ]);
    await expect(baselinePreflight(legacy)).rejects.toThrow('desconhecidas');
    await legacy.query('DELETE FROM migrations WHERE name=$1', [
      'UnknownMigration1',
    ]);
    expect(await baselinePreflight(legacy)).toBe(true);
  });

  it('NestJS inicializa uma conexão e readiness consulta o banco descartável', async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = emptyUrl;
    try {
      const { AppModule } = await import('../../src/app.module.js');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = module.createNestApplication();
      try {
        await app.init();
        expect(app.get(DataSource)).toBeInstanceOf(DatabaseSource);
        expect(app.get(DataSource).options.synchronize).toBe(false);
        await request(app.getHttpServer()).get('/health/ready').expect(200);
      } finally {
        await app.close();
      }
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
