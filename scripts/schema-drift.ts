import 'dotenv/config';
import source from '../src/integrations/database/data-source';
import { assertPhysicalChecksMapped } from '../src/integrations/database/check-mapping';

async function main(): Promise<void> {
  try {
    await source.initialize();
    await assertPhysicalChecksMapped(source);
    const diff = await source.driver.createSchemaBuilder().log();
    if (diff.upQueries.length) {
      console.error(
        `Drift TypeORM: ${diff.upQueries.length} comandos pendentes (nenhum executado).`,
      );
      process.exitCode = 1;
    } else
      console.log('Entidades × PostgreSQL: zero drift e zero SQL pendente.');
  } finally {
    if (source.isInitialized) await source.destroy();
  }
}
main().catch(() => {
  console.error('Não foi possível verificar drift TypeORM.');
  process.exitCode = 1;
});
