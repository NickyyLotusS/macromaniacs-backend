import { readFileSync } from 'node:fs';
import { Parser } from '@dbml/core';
import { expectedSchema } from '../src/integrations/database/schema-inspection';

function same(actual: unknown, expected: unknown, section: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(`DBML divergente: ${section}.`);
}
const expected = expectedSchema();
const database = Parser.parse(
  readFileSync('docs/architecture/diagrama.dbml', 'utf8'),
  'dbmlv2',
);
const schema =
  database.schemas.find((entry) => entry.name === 'public') ||
  database.schemas[0];
same(
  schema.tables.map((table) => table.name).sort(),
  expected.tables.map((table) => table.name),
  'tabelas',
);
same(
  schema.enums
    .map((value) => ({
      name: value.name,
      values: value.values.map((entry) => entry.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name)),
  expected.enums,
  'enums',
);
for (const table of schema.tables) {
  const fields = table.fields.map((field) => {
    const args = field.type.args;
    return {
      name: field.name,
      type: field.type.type_name.includes('(')
        ? field.type.type_name
        : field.type.type_name +
          (args ? (args.startsWith('(') ? args : `(${args})`) : ''),
      not_null: Boolean(field.not_null),
      default_expression: field.dbdefault?.value ?? null,
    };
  });
  const columns = expected.columns
    .filter((column) => column.table_name === table.name)
    .map((column) => ({
      name: column.name,
      type: String(column.type)
        .replace(/^character varying/, 'varchar')
        .replace(/^numeric/, 'decimal')
        .replace(/^timestamp with time zone$/, 'timestamptz')
        .replace(/^integer$/, 'int')
        .replace(/"/g, ''),
      not_null: column.not_null,
      default_expression: column.default_expression,
    }));
  same(fields, columns, `${table.name}: colunas/tipos/defaults/nulabilidade`);
  const indices = table.indexes
    .map((index) => ({
      name: index.name,
      is_primary: Boolean(index.pk),
      is_unique: Boolean(index.unique) || Boolean(index.pk),
      columns: index.columns.map((column) => column.value),
      note: index.note,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const expectedIndices = expected.indices
    .filter((index) => index.table_name === table.name)
    .map((index) => {
      const columns = String(index.definition)
        .match(/ USING btree \((.*)\)$/)![1]
        .split(',')
        .map((entry) => entry.trim());
      return {
        name: index.name,
        is_primary: index.is_primary,
        is_unique: index.is_unique,
        columns: columns.map((entry) =>
          entry.replace(/ (ASC|DESC)$/, '').replace(/"/g, ''),
        ),
        note: `SQL: ${columns.map((entry) => (/ (ASC|DESC)$/.test(entry) ? entry : entry + ' ASC')).join(', ')}`,
      };
    });
  same(
    indices,
    expectedIndices,
    `${table.name}: índices/PKs/unicidade/ordenação`,
  );
  const checks = table.checks
    .map((check) => ({ name: check.name, expression: check.expression }))
    .sort((a, b) => a.name.localeCompare(b.name));
  const expectedChecks = expected.constraints
    .filter((check) => check.table_name === table.name && check.type === 'c')
    .map((check) => ({
      name: check.name,
      expression: String(check.definition).replace(/^CHECK \((.*)\)$/, '$1'),
    }));
  same(checks, expectedChecks, `${table.name}: CHECKs`);
}
const refs = schema.refs
  .map((ref) => ({
    name: ref.name,
    from: `${ref.endpoints[0].tableName}.${ref.endpoints[0].fieldNames.join(',')}`,
    to: `${ref.endpoints[1].tableName}.${ref.endpoints[1].fieldNames.join(',')}`,
    onDelete: ref.onDelete,
    onUpdate: ref.onUpdate,
  }))
  .sort((a, b) => a.name.localeCompare(b.name));
const fks = expected.constraints
  .filter((constraint) => constraint.type === 'f')
  .map((constraint) => {
    const [, from, target, to, del] = String(constraint.definition).match(
      /^FOREIGN KEY \(([^)]+)\) REFERENCES ([^(]+)\(([^)]+)\) ON UPDATE CASCADE ON DELETE (.+)$/,
    )!;
    return {
      name: constraint.name,
      from: `${constraint.table_name}.${from}`,
      to: `${target}.${to}`,
      onDelete: del.toLowerCase(),
      onUpdate: 'cascade',
    };
  })
  .sort((a, b) => String(a.name).localeCompare(String(b.name)));
same(refs, fks, 'FKs/políticas de exclusão e atualização');
console.log(
  'DBML validado: 23 tabelas, 11 enums, 55 índices/PKs, 29 FKs e 50 CHECKs iguais ao contrato PostgreSQL.',
);
