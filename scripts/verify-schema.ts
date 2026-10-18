import 'dotenv/config';
import type { DataSource } from 'typeorm';
import { DatabaseSource } from '../src/integrations/database/database-source';
import { databaseOptions } from '../src/integrations/database/database.options';
import {
  assertSchemaParity,
  inspectSchema,
} from '../src/integrations/database/schema-inspection';

async function main(): Promise<void> {
  const source = new DatabaseSource(databaseOptions(process.env.DATABASE_URL));
  let reference: DataSource | undefined;
  try {
    await source.initialize();
    if (process.env.REFERENCE_DATABASE_URL) {
      reference = new DatabaseSource(
        databaseOptions(process.env.REFERENCE_DATABASE_URL),
      );
      await reference.initialize();
    }
    const actual = await inspectSchema(source);
    assertSchemaParity(
      actual,
      reference ? await inspectSchema(reference) : undefined,
    );
    console.log(
      `Paridade confirmada: ${actual.tables.length} tabelas, ${actual.enums.length} enums, ${actual.indices.length} índices, ${actual.constraints.length} constraints.`,
    );
  } finally {
    if (reference?.isInitialized) await reference.destroy();
    if (source.isInitialized) await source.destroy();
  }
}
main().catch((error: Error) => {
  console.error(
    error.message.startsWith('Divergência')
      ? error.message
      : 'Verificação falhou; confira conexão e schema sem expor credenciais.',
  );
  process.exitCode = 1;
});
