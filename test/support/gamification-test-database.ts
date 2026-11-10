import type { DataSource } from 'typeorm';
import { createMealTestDataSource, resetMealData } from './meal-test-database';

export async function createGamificationTestDataSource(): Promise<DataSource> {
  const dataSource = await createMealTestDataSource();
  await dataSource.query(`
    CREATE TABLE "achievements" (
      "id" uuid PRIMARY KEY,
      "code" varchar(50) NOT NULL UNIQUE,
      "title" varchar(100) NOT NULL,
      "description" text,
      "icon_url" varchar(500),
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "daily_missions" (
      "id" uuid PRIMARY KEY,
      "code" varchar(50) NOT NULL UNIQUE,
      "title" varchar(150) NOT NULL,
      "target_count" integer NOT NULL,
      "points_reward" integer NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "point_transactions" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "amount" integer NOT NULL,
      "reason" text NOT NULL,
      "metadata" jsonb NOT NULL DEFAULT '{}',
      "idempotency_key" varchar(128),
      "source_type" varchar(64),
      "source_id" uuid,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "point_transactions_user_id_idempotency_key_key"
      ON "point_transactions" ("user_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL;
    CREATE TABLE "user_achievements" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "achievement_id" uuid NOT NULL REFERENCES "achievements"("id"),
      "unlocked_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("user_id", "achievement_id")
    );
    CREATE TABLE "user_daily_missions" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "mission_id" uuid NOT NULL REFERENCES "daily_missions"("id"),
      "current_progress" integer NOT NULL DEFAULT 0,
      "is_claimed" boolean NOT NULL DEFAULT false,
      "date" date NOT NULL,
      PRIMARY KEY ("user_id", "mission_id", "date")
    );
    INSERT INTO "achievements" ("id", "code", "title") VALUES
      ('20000000-0000-4000-8000-000000000001', 'FIRST_MEAL', 'Primeiro Prato'),
      ('20000000-0000-4000-8000-000000000002', 'STREAK_3', '3 Dias no Foco'),
      ('20000000-0000-4000-8000-000000000003', 'STREAK_7', '7 Dias no Foco');
    INSERT INTO "daily_missions"
      ("id", "code", "title", "target_count", "points_reward") VALUES
      ('30000000-0000-4000-8000-000000000001', 'LOG_THREE_MEALS', 'Registrar 3 refeições', 3, 15),
      ('30000000-0000-4000-8000-000000000002', 'HIT_PROTEIN_TARGET', 'Meta de proteína', 1, 30),
      ('30000000-0000-4000-8000-000000000003', 'REACT_TO_FRIEND_POST', 'Reagir no feed', 1, 5);
  `);
  return dataSource;
}

export async function resetGamificationData(
  dataSource: DataSource,
): Promise<void> {
  await dataSource.query('DELETE FROM "user_daily_missions"');
  await dataSource.query('DELETE FROM "user_achievements"');
  await dataSource.query('DELETE FROM "point_transactions"');
  await resetMealData(dataSource);
}
