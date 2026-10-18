import 'dotenv/config';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSource } from '../src/integrations/database/database-source';
import { databaseOptions } from '../src/integrations/database/database.options';
import { DefinitiveBaseline1789430400000 } from '../src/integrations/database/migrations/1789430400000-DefinitiveBaseline';
import { baselinePreflight } from './baseline-preflight';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const fake = args.includes('--fake');
  const backupIndex = args.indexOf('--backup');
  const source = new DatabaseSource({
    ...databaseOptions(process.env.DATABASE_URL),
    migrations: [DefinitiveBaseline1789430400000],
  });
  try {
    await source.initialize();
    const applied = await baselinePreflight(source);
    if (!fake) {
      console.log(
        `Preflight aprovado; baseline ${applied ? 'já registrada' : 'pendente'}. Nenhuma alteração executada.`,
      );
      return;
    }
    if (
      !args.includes('--confirm-existing-database') ||
      backupIndex < 0 ||
      !args[backupIndex + 1]
    )
      throw new Error(
        'Registro exige autorização explícita e --backup com restauração validada.',
      );
    const path = resolve(args[backupIndex + 1]);
    const content = readFileSync(path);
    const manifest = JSON.parse(readFileSync(`${path}.json`, 'utf8'));
    const url = new URL(process.env.DATABASE_URL!);
    const createdAt = Date.parse(manifest.createdAt);
    if (
      !statSync(path).isFile() ||
      content.subarray(0, 5).toString() !== 'PGDMP' ||
      createHash('sha256').update(content).digest('hex') !== manifest.sha256 ||
      manifest.database !== decodeURIComponent(url.pathname.slice(1)) ||
      manifest.host !== url.hostname ||
      manifest.port !== (url.port || '5432') ||
      manifest.restoreVerified !== true ||
      !Number.isFinite(createdAt) ||
      createdAt > Date.now() ||
      Date.now() - createdAt > 24 * 60 * 60 * 1000
    )
      throw new Error(
        'Backup inválido, antigo, não restaurado ou de outro banco.',
      );
    if (applied) {
      console.log('Baseline já registrada; nenhuma alteração necessária.');
      return;
    }
    // This dedicated DataSource contains ONLY the verified baseline, never future migrations.
    await source.runMigrations({ fake: true, transaction: 'all' });
    console.log(
      'Somente a baseline TypeORM foi registrada com --fake; DDL não executado.',
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch((error: Error) => {
  const safe =
    /^(Histórico|Migrations TypeORM|Divergência|Registro exige|Backup inválido)/.test(
      error.message,
    );
  console.error(
    safe ? error.message : 'Preflight falhou; nenhuma transição autorizada.',
  );
  process.exitCode = 1;
});
