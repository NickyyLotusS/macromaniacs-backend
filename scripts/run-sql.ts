import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import source from '../src/integrations/database/data-source';

async function main(): Promise<void> {
  try {
    await source.initialize();
    const [{ database }] = await source.query(
      'SELECT current_database() AS database',
    );
    if (!/^macromaniacs_test_[a-z0-9_]+$/.test(database))
      throw new Error(
        'Testes SQL exigem banco descartável macromaniacs_test_*.',
      );
    const sql = readFileSync(
      resolve('tests/sql/integrity.sql'),
      'utf8',
    ).replace(/^\\set.*$/gm, '');
    await source.query(sql);
    console.log('Testes SQL aprovados; alterações revertidas com ROLLBACK.');
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Testes SQL falharam; verifique banco descartável e integridade.',
  );
  process.exitCode = 1;
});
