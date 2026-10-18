import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseSource } from './database-source';
import type { DataSourceOptions } from 'typeorm';
import { databaseOptions } from './database.options';
import { DATABASE_HEALTH } from '../../shared/database/database-health';
import { DatabaseHealthAdapter } from './database-health.adapter';

@Global()
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...databaseOptions(config.getOrThrow<string>('DATABASE_URL')),
        retryAttempts: 3,
        retryDelay: 1000,
      }),
      dataSourceFactory: async (options) => {
        const source = new DatabaseSource(options as DataSourceOptions);
        try {
          return await source.initialize();
        } catch {
          // Do not propagate driver exceptions that might expose connection details.
          throw new Error(
            'PostgreSQL indisponível; verifique rede e credenciais.',
          );
        }
      },
    }),
  ],
  providers: [{ provide: DATABASE_HEALTH, useClass: DatabaseHealthAdapter }],
  exports: [DATABASE_HEALTH],
})
export class DatabaseModule {}
