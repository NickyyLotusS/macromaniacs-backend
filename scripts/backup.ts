import 'dotenv/config';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSource } from '../src/integrations/database/database-source';
import { databaseOptions } from '../src/integrations/database/database.options';
import { inspectSchema } from '../src/integrations/database/schema-inspection';
import { inspectData } from '../src/integrations/database/data-inspection';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const containerIndex = args.indexOf('--container');
  const container =
    containerIndex < 0 ? 'macromaniacs_postgres' : args[containerIndex + 1];
  const outputIndex = args.indexOf('--output');
  const output = resolve(
    outputIndex < 0
      ? `backups/macromaniacs_typeorm_${new Date().toISOString().replace(/[:.]/g, '-')}.dump`
      : args[outputIndex + 1],
  );
  if (
    !output.endsWith('.dump') ||
    !container ||
    !/^[a-zA-Z0-9_-]+$/.test(container)
  )
    throw new Error('Destino/container de backup inválido.');
  const source = new DatabaseSource(databaseOptions(process.env.DATABASE_URL));
  const url = new URL(process.env.DATABASE_URL!);
  const database = decodeURIComponent(url.pathname.slice(1));
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    (url.port || '5432') !== '5433' ||
    database !== 'macromaniacs_db' ||
    decodeURIComponent(url.username) !== 'postgres'
  )
    throw new Error(
      'Este helper atende somente à infraestrutura local identificada. Use o processo de infra para outros ambientes.',
    );
  const docker = process.env.DOCKER_BIN || 'docker';
  const mounts = JSON.parse(
    execFileSync(
      docker,
      ['inspect', container, '--format', '{{json .Mounts}}'],
      { encoding: 'utf8' },
    ),
  );
  const expectedVolume =
    process.env.POSTGRES_VOLUME || 'macromaniacs-backend_pgdata';
  if (
    !mounts.some(
      (mount: { Name: string; Destination: string }) =>
        mount.Name === expectedVolume &&
        mount.Destination === '/var/lib/postgresql/data',
    )
  )
    throw new Error('Volume de backup divergente; nenhuma operação executada.');
  const runner = source.createQueryRunner();
  try {
    await source.initialize();
    const schema = await inspectSchema(source);
    await runner.connect();
    await runner.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await runner.query("SET LOCAL TIME ZONE 'UTC'");
    const [{ snapshot }] = await runner.query(
      'SELECT pg_export_snapshot() AS snapshot',
    );
    const data = await inspectData(runner, schema);
    const history = await runner.query(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
    );
    mkdirSync(dirname(output), { recursive: true });
    const fd = openSync(output, 'wx', 0o600);
    try {
      const dump = spawnSync(
        docker,
        [
          'exec',
          container,
          'pg_dump',
          '-U',
          'postgres',
          '-d',
          database,
          '--format=custom',
          '--no-owner',
          '--no-privileges',
          '--snapshot',
          snapshot,
        ],
        { stdio: ['ignore', fd, 'pipe'] },
      );
      if (dump.status !== 0)
        throw new Error(
          'pg_dump falhou; o arquivo parcial foi preservado, não o utilize.',
        );
    } finally {
      closeSync(fd);
    }
    const content = readFileSync(output);
    if (
      content.subarray(0, 5).toString() !== 'PGDMP' ||
      statSync(output).size < 1
    )
      throw new Error('Dump externo inválido.');
    const input = openSync(output, 'r');
    let listing;
    try {
      listing = spawnSync(
        docker,
        ['exec', '-i', container, 'pg_restore', '--list'],
        { stdio: [input, 'pipe', 'pipe'], encoding: 'utf8' },
      );
    } finally {
      closeSync(input);
    }
    if (listing.status !== 0)
      throw new Error('pg_restore --list rejeitou o backup.');
    const manifest = {
      createdAt: new Date().toISOString(),
      database,
      host: url.hostname,
      port: url.port || '5432',
      container,
      volume: expectedVolume,
      bytes: content.length,
      sha256: createHash('sha256').update(content).digest('hex'),
      restoreVerified: false,
      schema,
      data,
      history,
    };
    writeFileSync(`${output}.json`, JSON.stringify(manifest, null, 2) + '\n', {
      flag: 'wx',
      mode: 0o600,
    });
    await runner.query('COMMIT');
    console.log(
      `Backup externo: ${output} (${content.length} bytes). Listagem verificada; restauração descartável ainda necessária.`,
    );
  } finally {
    if (!runner.isReleased) {
      try {
        await runner.query('ROLLBACK');
      } catch {
        /* No active transaction or connection. */
      }
      await runner.release();
    }
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Backup não validado; confira conexão, volume e destino sem expor credenciais.',
  );
  process.exitCode = 1;
});
