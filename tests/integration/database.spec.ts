import 'reflect-metadata';
import '../../test/setup-env';
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
  baselineExpectedSchema,
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
import { COMPLETION_NAME } from '../../src/integrations/database/migrations/1794096000000-BackendCompletionCore';
import { configureApplication } from '../../src/app.setup';

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

  it('A: baseline e migration aditiva criam o contrato completo; seed é idempotente', async () => {
    const applied = await empty.runMigrations({ transaction: 'all' });
    expect(applied.map((migration) => migration.name)).toEqual([
      BASELINE_NAME,
      COMPLETION_NAME,
    ]);
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
    assertSchemaParity(beforeSchema, baselineExpectedSchema());
    expect(await baselinePreflight(legacy)).toBe(false);
    const [{ usersBefore }] = (await legacy.query(
      'SELECT count(*)::int AS "usersBefore" FROM users',
    )) as Array<{ usersBefore: number }>;
    const migrations = [...legacy.migrations];
    legacy.migrations.splice(1);
    await legacy.runMigrations({ fake: true, transaction: 'all' });
    legacy.migrations.push(...migrations.slice(1));
    expect(
      (await legacy.runMigrations({ transaction: 'all' })).map(
        (migration) => migration.name,
      ),
    ).toEqual([COMPLETION_NAME]);
    assertSchemaParity(await inspectSchema(legacy), await inspectSchema(empty));
    const [{ usersAfter }] = (await legacy.query(
      'SELECT count(*)::int AS "usersAfter" FROM users',
    )) as Array<{ usersAfter: number }>;
    expect(usersAfter).toBe(usersBefore);
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
      true,
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

  it('mede planos dos hot paths sobre massa sintética reproduzível', async () => {
    const userId = '90000000-0000-0000-0000-000000000001';
    const groupId = '91000000-0000-0000-0000-000000000001';
    const metrics: Array<{
      path: string;
      planningMs: number;
      executionMs: number;
      rootNode: string;
    }> = [];
    const explain = async (
      path: string,
      query: string,
      parameters: unknown[],
    ) => {
      const rows = (await empty.query(
        `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${query}`,
        parameters,
      )) as Array<{
        'QUERY PLAN': Array<{
          Plan: { 'Node Type': string };
          'Planning Time': number;
          'Execution Time': number;
        }>;
      }>;
      const plan = rows[0]['QUERY PLAN'][0];
      expect(Number.isFinite(plan['Planning Time'])).toBe(true);
      expect(Number.isFinite(plan['Execution Time'])).toBe(true);
      metrics.push({
        path,
        planningMs: plan['Planning Time'],
        executionMs: plan['Execution Time'],
        rootNode: plan.Plan['Node Type'],
      });
    };

    await empty.query('BEGIN');
    try {
      await empty.query(
        `INSERT INTO users(id,email,password_hash,username,display_name)
         VALUES($1,'performance@example.com','test-hash','performance_user','Performance User')`,
        [userId],
      );
      await empty.query(
        `INSERT INTO user_stats(user_id,total_points,current_streak,best_streak,timezone)
         VALUES($1,0,0,0,'UTC')`,
        [userId],
      );
      await empty.query(
        `INSERT INTO groups(id,name,invite_code,creator_id,is_private)
         VALUES($1,'Performance Group','PERF0001',$2,true)`,
        [groupId, userId],
      );
      await empty.query(
        `INSERT INTO group_members(group_id,user_id,role)
         VALUES($1,$2,'ADMIN')`,
        [groupId, userId],
      );
      await empty.query(
        `INSERT INTO daily_nutrition_snapshots
          (user_id,food_date,timezone,calories,protein,carbs,fat,fiber,meal_count)
         SELECT $1, DATE '2020-01-01' + value, 'UTC', 2000, 150, 200, 70, 25, 4
         FROM generate_series(0,1999) AS value`,
        [userId],
      );
      await empty.query(
        `INSERT INTO meal_logs
          (id,user_id,name,consumed_at,food_date,timezone)
         SELECT ('92000000-0000-0000-0000-' || lpad(value::text,12,'0'))::uuid,
                $1, 'Synthetic meal', TIMESTAMPTZ '2020-01-01 00:00:00Z' + value * INTERVAL '1 minute',
                DATE '2020-01-01' + (value % 2000), 'UTC'
         FROM generate_series(1,5000) AS value`,
        [userId],
      );
      await empty.query(
        `INSERT INTO feed_posts(id,group_id,user_id,content,created_at)
         SELECT ('93000000-0000-0000-0000-' || lpad(value::text,12,'0'))::uuid,
                $1, $2, 'Synthetic post ' || value,
                TIMESTAMPTZ '2020-01-01 00:00:00Z' + value * INTERVAL '1 minute'
         FROM generate_series(1,5000) AS value`,
        [groupId, userId],
      );
      await empty.query(
        `INSERT INTO point_transactions
          (id,user_id,amount,reason,metadata,idempotency_key,source_type,created_at)
         SELECT ('94000000-0000-0000-0000-' || lpad(value::text,12,'0'))::uuid,
                $1, 1, 'ADMIN_ADJUSTMENT', '{}', 'perf-' || value, 'performance-test',
                TIMESTAMPTZ '2020-01-01 00:00:00Z' + value * INTERVAL '1 minute'
         FROM generate_series(1,5000) AS value`,
        [userId],
      );
      await empty.query(
        `INSERT INTO foods
          (id,name,source,barcode,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g,fiber_per_100g)
         SELECT ('95000000-0000-0000-0000-' || lpad(value::text,12,'0'))::uuid,
                'Synthetic Food ' || lpad(value::text,5,'0'), 'MANUAL',
                '99000' || lpad(value::text,7,'0'), 100, 10, 15, 2, 3
         FROM generate_series(1,5000) AS value`,
      );
      await empty.query(
        'ANALYZE daily_nutrition_snapshots, meal_logs, feed_posts, point_transactions, foods',
      );

      await explain(
        'nutrition history',
        `SELECT * FROM daily_nutrition_snapshots
         WHERE user_id=$1 AND food_date BETWEEN DATE '2023-01-01' AND DATE '2025-12-31'
         ORDER BY food_date DESC LIMIT 20`,
        [userId],
      );
      await explain(
        'meal history',
        `SELECT * FROM meal_logs
         WHERE user_id=$1 AND deleted_at IS NULL
         ORDER BY consumed_at DESC LIMIT 20`,
        [userId],
      );
      await explain(
        'group feed',
        `SELECT * FROM feed_posts
         WHERE group_id=$1 ORDER BY created_at DESC,id DESC LIMIT 20`,
        [groupId],
      );
      await explain(
        'points ledger and balance',
        `SELECT amount,created_at FROM point_transactions
         WHERE user_id=$1 ORDER BY created_at DESC LIMIT 20`,
        [userId],
      );
      await explain('food barcode', `SELECT * FROM foods WHERE barcode=$1`, [
        '9900000005000',
      ]);

      const indexes = (
        (await empty.query(
          `SELECT indexname FROM pg_indexes
           WHERE schemaname='public' AND indexname = ANY($1::text[])
           ORDER BY indexname`,
          [
            [
              'foods_barcode_key',
              'foods_name_idx',
              'meal_logs_user_id_consumed_at_idx',
              'meal_logs_user_id_food_date_idx',
              'daily_nutrition_snapshots_user_id_food_date_idx',
              'group_members_user_id_idx',
              'feed_posts_group_id_created_at_idx',
              'point_transactions_user_id_created_at_idx',
              'user_cosmetics_pkey',
            ],
          ],
        )) as Array<{ indexname: string }>
      ).map((row) => row.indexname);
      expect(indexes).toHaveLength(9);
      console.log('PERFORMANCE_BASELINE', JSON.stringify(metrics));
    } finally {
      await empty.query('ROLLBACK');
    }
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

  it('serializa compras concorrentes e preserva saldo/inventário atômicos', async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = emptyUrl;
    try {
      const { AppModule } = await import('../../src/app.module.js');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = module.createNestApplication();
      configureApplication(app);
      try {
        await app.init();
        await request(app.getHttpServer())
          .post('/v1/auth/register')
          .send({
            email: 'concurrent@example.com',
            username: 'concurrent_user',
            password: 'strong-password-123',
            termsAccepted: true,
          })
          .expect(201);
        const login = await request(app.getHttpServer())
          .post('/v1/auth/login')
          .send({
            identifier: 'concurrent_user',
            password: 'strong-password-123',
          })
          .expect(200);
        const [{ id: userId }] = (await empty.query(
          "SELECT id FROM users WHERE username='concurrent_user'",
        )) as Array<{ id: string }>;
        await empty.query(
          `INSERT INTO point_transactions
            (id,user_id,amount,reason,metadata,idempotency_key,source_type)
           VALUES($1,$2,100,'ADMIN_ADJUSTMENT','{}','concurrency-credit','integration-test')`,
          [randomUUID(), userId],
        );
        await empty.query(
          'UPDATE user_stats SET total_points=100 WHERE user_id=$1',
          [userId],
        );
        const catalog = await request(app.getHttpServer())
          .get('/v1/rewards/catalog')
          .expect(200);
        const itemId = catalog.body[0].id as string;
        const token = login.body.accessToken as string;
        const results = await Promise.all([
          request(app.getHttpServer())
            .post(`/v1/rewards/purchases/${itemId}`)
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'concurrent-a'),
          request(app.getHttpServer())
            .post(`/v1/rewards/purchases/${itemId}`)
            .set('Authorization', `Bearer ${token}`)
            .set('Idempotency-Key', 'concurrent-b'),
        ]);
        expect(results.map((result) => result.status).sort()).toEqual([
          201, 409,
        ]);
        expect(
          await empty.query(
            'SELECT total_points FROM user_stats WHERE user_id=$1',
            [userId],
          ),
        ).toEqual([{ total_points: 50 }]);
        expect(
          await empty.query(
            'SELECT count(*)::int AS count FROM user_cosmetics WHERE user_id=$1',
            [userId],
          ),
        ).toEqual([{ count: 1 }]);
        expect(
          await empty.query(
            `SELECT count(*)::int AS count FROM point_transactions
             WHERE user_id=$1 AND reason='COSMETIC_PURCHASE'`,
            [userId],
          ),
        ).toEqual([{ count: 1 }]);
        await empty.query('DELETE FROM users WHERE id=$1', [userId]);
      } finally {
        await app.close();
      }
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });

  it('executa a jornada móvel completa por HTTP real sem mocks ou duplicidade', async () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = emptyUrl;
    try {
      const { AppModule } = await import('../../src/app.module.js');
      const module = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      const app = module.createNestApplication();
      configureApplication(app);
      try {
        await app.init();
        const server = app.getHttpServer();
        const registerAndLogin = async (username: string) => {
          const registration = await request(server)
            .post('/v1/auth/register')
            .send({
              email: `${username}@example.com`,
              username,
              password: 'strong-password-123',
              termsAccepted: true,
            })
            .expect(201);
          const login = await request(server)
            .post('/v1/auth/login')
            .send({ identifier: username, password: 'strong-password-123' })
            .expect(200);
          return {
            userId: registration.body.id as string,
            token: login.body.accessToken as string,
          };
        };

        await request(server).get('/v1/auth/me').expect(401);
        const alice = await registerAndLogin('mobile_alice');
        const bob = await registerAndLogin('mobile_bob');
        await request(server)
          .post('/v1/auth/register')
          .send({
            email: 'mobile_alice@example.com',
            username: 'mobile_alice_duplicate',
            password: 'strong-password-123',
            termsAccepted: true,
          })
          .expect(409);

        const profile = await request(server)
          .patch('/v1/users/me')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({
            displayName: 'Alice Mobile',
            dateOfBirth: '1994-03-10',
            biologicalSex: 'FEMALE',
            heightCm: 165,
            currentWeightKg: 62,
            goal: 'MAINTAIN',
            activityLevel: 'MODERATE',
            timezone: 'America/Sao_Paulo',
          })
          .expect(200);
        expect(profile.body.nutrition.calorieTargetKcalPerDay).toBeGreaterThan(
          0,
        );

        const food = await request(server)
          .post('/v1/foods/manual')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({
            name: 'Arroz jornada móvel',
            caloriesPer100g: 200,
            proteinPer100g: 10,
            carbsPer100g: 32,
            fatPer100g: 4,
            fiberPer100g: 3,
            servingSizeG: 100,
          })
          .expect(201);
        const search = await request(server)
          .get('/v1/foods?q=Arroz%20jornada&page=1&limit=20&external=false')
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200);
        expect(search.body.items).toContainEqual(
          expect.objectContaining({ id: food.body.id }),
        );

        const mealPayload = {
          name: 'Almoço integrado',
          consumedAt: new Date().toISOString(),
          items: [{ foodId: food.body.id, amountGrams: 150 }],
        };
        await request(server)
          .post('/v1/meals/manual')
          .set('Authorization', `Bearer ${alice.token}`)
          .send(mealPayload)
          .expect(400);
        const firstMeal = await request(server)
          .post('/v1/meals/manual')
          .set('Authorization', `Bearer ${alice.token}`)
          .set('Idempotency-Key', 'mobile-lost-response')
          .send(mealPayload)
          .expect(201);
        // O cliente pode perder a resposta; o replay usa a mesma chave.
        const replayedMeal = await request(server)
          .post('/v1/meals/manual')
          .set('Authorization', `Bearer ${alice.token}`)
          .set('Idempotency-Key', 'mobile-lost-response')
          .send(mealPayload)
          .expect(201);
        expect(replayedMeal.body.id).toBe(firstMeal.body.id);

        const [{ mealCount }] = (await empty.query(
          'SELECT count(*)::int AS "mealCount" FROM meal_logs WHERE user_id=$1 AND deleted_at IS NULL',
          [alice.userId],
        )) as Array<{ mealCount: number }>;
        expect(mealCount).toBe(1);
        await request(server)
          .get(`/v1/meals/${firstMeal.body.id}`)
          .set('Authorization', `Bearer ${bob.token}`)
          .expect(404);

        const progress = await request(server)
          .get(`/v1/progress/daily?date=${firstMeal.body.foodDate}`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200);
        expect(progress.body).toMatchObject({
          calories: 300,
          mealCount: 1,
          targetCalories: profile.body.nutrition.calorieTargetKcalPerDay,
        });
        const summary = await request(server)
          .get('/v1/gamification/summary')
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200);
        expect(summary.body).toMatchObject({
          totalPoints: 15,
          currentStreak: 1,
        });
        const achievements = await request(server)
          .get('/v1/gamification/achievements')
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200);
        expect(achievements.body).toContainEqual(
          expect.objectContaining({ code: 'FIRST_MEAL' }),
        );
        await request(server)
          .get(`/v1/gamification/missions?date=${firstMeal.body.foodDate}`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200)
          .expect(({ body }) => expect(body).toHaveLength(3));

        const group = await request(server)
          .post('/v1/groups')
          .set('Authorization', `Bearer ${alice.token}`)
          .send({
            name: 'Integração Mobile',
            description: 'Feed usado como chat do grupo',
            isPrivate: true,
          })
          .expect(201);
        await request(server)
          .post('/v1/groups/join')
          .set('Authorization', `Bearer ${bob.token}`)
          .send({ inviteCode: group.body.inviteCode })
          .expect(201);
        await request(server)
          .patch(`/v1/groups/${group.body.id}/members/${alice.userId}`)
          .set('Authorization', `Bearer ${bob.token}`)
          .send({ role: 'MEMBER' })
          .expect(403);
        const post = await request(server)
          .post(`/v1/groups/${group.body.id}/feed`)
          .set('Authorization', `Bearer ${bob.token}`)
          .send({ content: 'Mensagem real no feed do grupo' })
          .expect(201);
        await request(server)
          .put(`/v1/groups/${group.body.id}/feed/${post.body.id}/reaction`)
          .set('Authorization', `Bearer ${alice.token}`)
          .send({ reactionType: 'FIRE' })
          .expect(200);
        const feed = await request(server)
          .get(`/v1/groups/${group.body.id}/feed?page=1&limit=20`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200);
        expect(feed.body).toMatchObject({
          items: [
            expect.objectContaining({
              id: post.body.id,
              content: 'Mensagem real no feed do grupo',
              reactions: expect.objectContaining({ FIRE: 1 }),
            }),
          ],
          meta: expect.objectContaining({ page: 1 }),
        });
        await request(server)
          .get(`/v1/groups/${group.body.id}/ranking`)
          .set('Authorization', `Bearer ${bob.token}`)
          .expect(200)
          .expect(({ body }) => expect(body).toHaveLength(2));
        await request(server)
          .delete(`/v1/groups/${group.body.id}/members/me`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(409);
        await request(server)
          .delete(`/v1/groups/${group.body.id}/members/me`)
          .set('Authorization', `Bearer ${bob.token}`)
          .expect(204);

        await empty.query(
          `INSERT INTO point_transactions
            (id,user_id,amount,reason,metadata,idempotency_key,source_type)
           VALUES($1,$2,200,'ADMIN_ADJUSTMENT','{}','mobile-credit','integration-test')`,
          [randomUUID(), alice.userId],
        );
        const catalog = await request(server)
          .get('/v1/rewards/catalog')
          .expect(200);
        const itemId = catalog.body[0].id as string;
        await request(server)
          .post(`/v1/rewards/purchases/${itemId}`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(400);
        const purchase = await request(server)
          .post(`/v1/rewards/purchases/${itemId}`)
          .set('Authorization', `Bearer ${alice.token}`)
          .set('Idempotency-Key', 'mobile-purchase')
          .expect(201);
        const purchaseReplay = await request(server)
          .post(`/v1/rewards/purchases/${itemId}`)
          .set('Authorization', `Bearer ${alice.token}`)
          .set('Idempotency-Key', 'mobile-purchase')
          .expect(201);
        expect(purchaseReplay.body).toEqual(purchase.body);
        await request(server)
          .put(`/v1/rewards/inventory/${itemId}/equip`)
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200)
          .expect(({ body }) => expect(body.isEquipped).toBe(true));
        await request(server)
          .get('/v1/rewards/inventory')
          .set('Authorization', `Bearer ${alice.token}`)
          .expect(200)
          .expect(({ body }) =>
            expect(body).toContainEqual(
              expect.objectContaining({ id: itemId, isEquipped: true }),
            ),
          );
      } finally {
        await app.close();
      }
    } finally {
      if (previous === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previous;
    }
  });
});
