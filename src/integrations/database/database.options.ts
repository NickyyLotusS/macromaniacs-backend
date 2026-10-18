import type { DataSourceOptions } from 'typeorm';
import { validateDatabaseUrl } from '../../shared/config/env.validation';
import { DATABASE_ENTITIES } from './entities';
import { DefinitiveBaseline1789430400000 } from './migrations/1789430400000-DefinitiveBaseline';

export function databaseOptions(url: unknown): DataSourceOptions {
  return {
    type: 'postgres',
    url: validateDatabaseUrl(url),
    schema: 'public',
    entities: DATABASE_ENTITIES,
    // Exactly one baseline; future reviewed migrations are added explicitly here.
    migrations: [DefinitiveBaseline1789430400000],
    migrationsTableName: 'migrations',
    synchronize: false,
    migrationsRun: false,
    installExtensions: false,
    logging: false,
    connectTimeoutMS: 5000,
    extra: { query_timeout: 5000 },
  };
}
