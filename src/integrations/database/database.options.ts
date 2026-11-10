import type { DataSourceOptions } from 'typeorm';
import { validateDatabaseUrl } from '../../shared/config/env.validation';
import { DATABASE_ENTITIES } from './entities';
import { DefinitiveBaseline1789430400000 } from './migrations/1789430400000-DefinitiveBaseline';
import { BackendCompletionCore1794096000000 } from './migrations/1794096000000-BackendCompletionCore';

export function databaseOptions(url: unknown): DataSourceOptions {
  return {
    type: 'postgres',
    url: validateDatabaseUrl(url),
    schema: 'public',
    entities: DATABASE_ENTITIES,
    // The baseline is immutable; reviewed changes are additive migrations.
    migrations: [
      DefinitiveBaseline1789430400000,
      BackendCompletionCore1794096000000,
    ],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    installExtensions: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { query_timeout: 5000 },
  };
}
