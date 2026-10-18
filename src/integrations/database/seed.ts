import 'dotenv/config';
import source from './data-source';
import { seedCatalogs } from './catalog-seed';

async function main(): Promise<void> {
  try {
    await source.initialize();
    await seedCatalogs(source);
    console.log(
      'Seed TypeORM concluído (4 achievements, 3 missões, 3 cosméticos conhecidos).',
    );
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error(
    'Seed falhou; confira conexão e integridade sem expor credenciais.',
  );
  process.exitCode = 1;
});
