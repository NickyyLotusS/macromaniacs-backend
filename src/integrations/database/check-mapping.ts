import type { DataSource } from 'typeorm';
import { inspectSchema } from './schema-inspection';

/** Refuse to generate SQL that silently drops an unmapped physical CHECK. */
export async function assertPhysicalChecksMapped(
  source: DataSource,
): Promise<void> {
  const schema = await inspectSchema(source);
  for (const constraint of schema.constraints.filter(
    (entry) => entry.type === 'c',
  )) {
    const table = String(constraint.table_name);
    const name = String(constraint.name);
    const check = source.hasMetadata(table)
      ? source.getMetadata(table).checks.find((entry) => entry.name === name)
      : undefined;
    if (!check)
      throw new Error(
        `CHECK SQL não representado: ${name}. Geração bloqueada; preserve-o em migration manual revisada.`,
      );
    if (
      check.expression !==
      String(constraint.definition).replace(/^CHECK \((.*)\)$/, '$1')
    )
      throw new Error(
        `CHECK alterado: ${name}. Revise uma migration SQL manual; TypeORM não deve omitir mudanças de expressão com o mesmo nome.`,
      );
  }
}
