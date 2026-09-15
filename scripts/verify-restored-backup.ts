import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import source from '../src/integrations/database/data-source';
import {
  assertSchemaParity,
  inspectSchema,
} from '../src/integrations/database/schema-inspection';
import { inspectData } from '../src/integrations/database/data-inspection';

async function main(): Promise<void> {
  const path = resolve(process.argv[2] || '');
  const content = readFileSync(path);
  const manifest = JSON.parse(readFileSync(`${path}.json`, 'utf8'));
  if (createHash('sha256').update(content).digest('hex') !== manifest.sha256)
    throw new Error('Checksum do backup divergente.');
  try {
    await source.initialize();
    const [{ database }] = await source.query(
      'SELECT current_database() AS database',
    );
    if (!/^macromaniacs_test_[a-z0-9_]+$/.test(database))
      throw new Error('Verificação de restore exige banco descartável.');
    const schema = await inspectSchema(source);
    assertSchemaParity(schema, manifest.schema);
    assertSchemaParity(schema);
    const data = await inspectData(source, schema);
    if (JSON.stringify(data) !== JSON.stringify(manifest.data))
      throw new Error('Dados restaurados divergem do snapshot exportado.');
    const history = await source.query(
      'SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name',
    );
    if (JSON.stringify(history) !== JSON.stringify(manifest.history))
      throw new Error('Histórico Prisma restaurado diverge.');
    manifest.restoreVerified = true;
    manifest.restoreDatabase = database;
    manifest.restoreVerifiedAt = new Date().toISOString();
    writeFileSync(`${path}.json`, JSON.stringify(manifest, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(
      'Restauração descartável validada: schema, dados de 23 tabelas e histórico Prisma iguais ao snapshot do backup.',
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error('Restore não validado; não registre baseline no banco real.');
  process.exitCode = 1;
});
