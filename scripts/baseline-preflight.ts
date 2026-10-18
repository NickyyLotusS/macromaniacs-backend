import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DataSource } from 'typeorm';
import {
  assertSchemaParity,
  inspectSchema,
} from '../src/integrations/database/schema-inspection';
import { BASELINE_NAME } from '../src/integrations/database/migrations/1789430400000-DefinitiveBaseline';

export async function baselinePreflight(source: DataSource): Promise<boolean> {
  assertSchemaParity(await inspectSchema(source));
  const [{ history }] = await source.query(
    "SELECT to_regclass('public._prisma_migrations') AS history",
  );
  if (!history)
    throw new Error('Histórico Prisma ausente; não use --fake em banco vazio.');
  const directory = resolve('legacy/prisma/migrations');
  const names = readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  const rows = await source.query(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY migration_name',
  );
  if (names.length !== 4 || rows.length !== names.length)
    throw new Error('Histórico Prisma inesperado.');
  for (const [index, name] of names.entries()) {
    const row = rows[index];
    const checksum = createHash('sha256')
      .update(readFileSync(resolve(directory, name, 'migration.sql')))
      .digest('hex');
    if (
      row.migration_name !== name ||
      row.checksum !== checksum ||
      !row.finished_at ||
      row.rolled_back_at
    )
      throw new Error(`Histórico Prisma incompatível: ${name}.`);
  }
  const [{ control }] = await source.query(
    "SELECT to_regclass('public.migrations') AS control",
  );
  if (!control) return false;
  const applied = await source.query(
    'SELECT name, timestamp FROM public.migrations ORDER BY id',
  );
  if (
    applied.some(
      (row: { name: string; timestamp: string }) =>
        row.name !== BASELINE_NAME || String(row.timestamp) !== '1789430400000',
    ) ||
    applied.length > 1
  )
    throw new Error(
      'Migrations TypeORM desconhecidas: interrompa a transição.',
    );
  return applied.length === 1;
}
