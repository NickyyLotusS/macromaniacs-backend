import { DataType, newDb } from 'pg-mem';
import type { DataSource } from 'typeorm';
import { DATABASE_ENTITIES } from '../../src/integrations/database/entities';

export async function createIdentityTestDataSource(): Promise<DataSource> {
  const memoryDatabase = newDb({ autoCreateForeignKeyIndices: true });
  memoryDatabase.public.registerFunction({
    name: 'current_database',
    returns: DataType.text,
    implementation: () => 'macromaniacs_test',
  });
  memoryDatabase.public.registerFunction({
    name: 'version',
    returns: DataType.text,
    implementation: () => 'PostgreSQL 15',
  });

  const dataSource = await memoryDatabase.adapters.createTypeormDataSource({
    type: 'postgres',
    entities: DATABASE_ENTITIES,
    synchronize: false,
    migrationsRun: false,
  });
  await dataSource.initialize();
  await dataSource.query(`
    CREATE TABLE "users" (
      "id" uuid PRIMARY KEY,
      "email" varchar(255) NOT NULL UNIQUE,
      "password_hash" varchar(255) NOT NULL,
      "username" varchar(50) NOT NULL UNIQUE,
      "display_name" varchar(100) NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "user_profiles" (
      "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
      "birth_date" date,
      "biological_sex" text,
      "height_cm" numeric(5,2),
      "current_weight_kg" numeric(5,2),
      "target_weight_kg" numeric(5,2),
      "target_date" date,
      "dietary_restrictions_note" text,
      "goal" text,
      "activity_level" text,
      "timezone" varchar(64) NOT NULL DEFAULT 'UTC',
      "onboarding_completed_at" timestamptz,
      "avatar_config" jsonb NOT NULL DEFAULT '{}',
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "user_terms_acceptances" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "terms_version" varchar(64) NOT NULL,
      "accepted_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("user_id", "terms_version")
    );
    CREATE TABLE "user_stats" (
      "user_id" uuid PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE,
      "current_streak" integer NOT NULL DEFAULT 0,
      "best_streak" integer NOT NULL DEFAULT 0,
      "total_points" integer NOT NULL DEFAULT 0,
      "last_activity_at" timestamptz,
      "last_activity_date" date,
      "timezone" varchar(64) NOT NULL DEFAULT 'UTC',
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "body_measurements" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "weight_kg" numeric(5,2) NOT NULL,
      "measured_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return dataSource;
}

export async function clearIdentityData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "body_measurements"');
  await dataSource.query('DELETE FROM "user_terms_acceptances"');
  await dataSource.query('DELETE FROM "user_stats"');
  await dataSource.query('DELETE FROM "user_profiles"');
  await dataSource.query('DELETE FROM "users"');
}
