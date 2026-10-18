import 'dotenv/config';
import { spawnSync } from 'node:child_process';
import source from '../src/integrations/database/data-source';
import { assertPhysicalChecksMapped } from '../src/integrations/database/check-mapping';

async function main(): Promise<void> {
  try {
    await source.initialize();
    const [{ database }] = await source.query(
      'SELECT current_database() AS database',
    );
    if (!/^macromaniacs_test_[a-z0-9_]+$/.test(database))
      throw new Error(
        'Geração exige cópia descartável macromaniacs_test_*, não banco real.',
      );
    await assertPhysicalChecksMapped(source);
  } finally {
    if (source.isInitialized) await source.destroy();
  }
  const args = process.argv.slice(2);
  if (args.some((arg) => arg === '-d' || arg.startsWith('--dataSource')))
    throw new Error('Não substituir o DataSource oficial.');
  const result = spawnSync(
    process.execPath,
    [
      '-r',
      'ts-node/register',
      require.resolve('typeorm/cli'),
      'migration:generate',
      ...args,
      '-d',
      'src/integrations/database/data-source.ts',
    ],
    { stdio: 'inherit', env: process.env },
  );
  process.exitCode = result.status ?? 1;
}
main().catch((error: Error) => {
  console.error(
    /^(CHECK|Geração exige|Não substituir)/.test(error.message)
      ? error.message
      : 'Geração interrompida; confira cópia descartável e constraints.',
  );
  process.exitCode = 1;
});
