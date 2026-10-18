import { readFileSync } from 'node:fs';
import { databaseResourcePath } from './resource-path';
import type { DataSource } from 'typeorm';

export type SchemaSnapshot = Record<string, Record<string, unknown>[]>;

const queries: Record<string, string> = {
  tables: `SELECT c.relname AS name, c.relkind AS kind, c.relpersistence AS persistence,
    c.relrowsecurity AS row_security, c.relforcerowsecurity AS force_row_security
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND c.relname NOT IN ('_prisma_migrations','migrations') ORDER BY c.relname`,
  columns: `SELECT c.relname AS table_name, a.attname AS name,
    row_number() OVER (PARTITION BY c.relname ORDER BY a.attnum)::int AS position,
    format_type(a.atttypid,a.atttypmod) AS type, a.attnotnull AS not_null,
    pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    a.attidentity AS identity, a.attgenerated AS generated,
    CASE WHEN a.attcollation=0 THEN NULL ELSE co.collname END AS collation
    FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
    LEFT JOIN pg_collation co ON co.oid=a.attcollation
    WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
    AND c.relname NOT IN ('_prisma_migrations','migrations') ORDER BY c.relname,a.attnum`,
  enums: `SELECT t.typname AS name, json_agg(e.enumlabel ORDER BY e.enumsortorder) AS values
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid
    WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`,
  constraints: `SELECT c.relname AS table_name, k.conname AS name, k.contype AS type,
    pg_get_constraintdef(k.oid) AS definition, k.convalidated AS validated,
    k.condeferrable AS deferrable, k.condeferred AS deferred, k.connoinherit AS no_inherit
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname NOT IN ('_prisma_migrations','migrations') ORDER BY c.relname,k.conname`,
  indices: `SELECT c.relname AS table_name, ci.relname AS name,
    pg_get_indexdef(i.indexrelid) AS definition, i.indisunique AS is_unique,
    i.indisprimary AS is_primary, i.indisvalid AS valid, i.indisready AS ready
    FROM pg_index i JOIN pg_class c ON c.oid=i.indrelid JOIN pg_class ci ON ci.oid=i.indexrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public'
    AND c.relname NOT IN ('_prisma_migrations','migrations') ORDER BY c.relname,ci.relname`,
  routines: `SELECT p.proname AS name, pg_get_function_identity_arguments(p.oid) AS arguments,
    pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prokind IN ('f','p') ORDER BY p.proname,arguments`,
  triggers: `SELECT c.relname AS table_name, t.tgname AS name, pg_get_triggerdef(t.oid) AS definition,
    t.tgenabled AS enabled FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal
    AND c.relname NOT IN ('_prisma_migrations','migrations') ORDER BY c.relname,t.tgname`,
  views: `SELECT c.relname AS name, c.relkind AS kind, pg_get_viewdef(c.oid) AS definition
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind IN ('v','m') ORDER BY c.relname`,
  sequences: `SELECT c.relname AS name, format_type(s.seqtypid,NULL) AS type,
    s.seqstart::text AS start, s.seqincrement::text AS increment, s.seqmin::text AS minimum,
    s.seqmax::text AS maximum, s.seqcache::text AS cache, s.seqcycle AS cycle
    FROM pg_sequence s JOIN pg_class c ON c.oid=s.seqrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND NOT EXISTS (SELECT 1 FROM pg_depend d JOIN pg_class owner ON owner.oid=d.refobjid
      WHERE d.objid=c.oid AND d.deptype IN ('a','i') AND owner.relname IN ('_prisma_migrations','migrations'))
    ORDER BY c.relname`,
};

export async function inspectSchema(
  source: DataSource,
): Promise<SchemaSnapshot> {
  const runner = source.createQueryRunner();
  await runner.connect();
  try {
    await runner.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const snapshot: SchemaSnapshot = {};
    for (const [section, sql] of Object.entries(queries))
      snapshot[section] = await runner.query(sql);
    await runner.query('COMMIT');
    return snapshot;
  } catch (error) {
    await runner.query('ROLLBACK');
    throw error;
  } finally {
    await runner.release();
  }
}

export function expectedSchema(): SchemaSnapshot {
  return JSON.parse(
    readFileSync(databaseResourcePath('schema-contract.json'), 'utf8'),
  );
}

export function assertSchemaParity(
  actual: SchemaSnapshot,
  expected = expectedSchema(),
): void {
  const sections = new Set([...Object.keys(actual), ...Object.keys(expected)]);
  const differences = [...sections].filter(
    (section) =>
      JSON.stringify(actual[section]) !== JSON.stringify(expected[section]),
  );
  if (differences.length)
    throw new Error(
      `Divergência estrutural nas seções: ${differences.join(', ')}. Não registre baseline nem aplique migrations.`,
    );
}
