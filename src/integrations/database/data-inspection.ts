import { createHash } from 'node:crypto';
import type { DataSource, QueryRunner } from 'typeorm';
import type { SchemaSnapshot } from './schema-inspection';

export async function inspectData(
  source: DataSource | QueryRunner,
  schema: SchemaSnapshot,
) {
  const result: Record<string, { count: number; sha256: string }> = {};
  for (const table of schema.tables) {
    const name = String(table.name);
    if (!/^[a-z_]+$/.test(name)) throw new Error('Nome de tabela inesperado.');
    const rows = await source.query(
      `SELECT to_jsonb(t)::text AS row FROM public."${name}" t ORDER BY to_jsonb(t)::text`,
    );
    result[name] = {
      count: rows.length,
      sha256: createHash('sha256').update(JSON.stringify(rows)).digest('hex'),
    };
  }
  return result;
}
