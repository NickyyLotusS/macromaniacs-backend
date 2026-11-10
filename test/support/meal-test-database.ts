import type { DataSource } from 'typeorm';
import {
  createDietPlanTestDataSource,
  resetDietPlanData,
} from './diet-plan-test-database';

export async function createMealTestDataSource(): Promise<DataSource> {
  const dataSource = await createDietPlanTestDataSource();
  await dataSource.query(`
    CREATE TABLE "meal_logs" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "planned_meal_id" uuid REFERENCES "planned_meals"("id") ON DELETE SET NULL,
      "name" varchar(100) NOT NULL,
      "photo_url" varchar(500),
      "consumed_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "food_date" date NOT NULL,
      "timezone" varchar(64) NOT NULL,
      "idempotency_key" varchar(128),
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "deleted_at" timestamptz
    );
    CREATE UNIQUE INDEX "meal_logs_user_id_idempotency_key_key"
      ON "meal_logs" ("user_id", "idempotency_key")
      WHERE "idempotency_key" IS NOT NULL;
    CREATE TABLE "meal_log_items" (
      "id" uuid PRIMARY KEY,
      "meal_log_id" uuid NOT NULL REFERENCES "meal_logs"("id") ON DELETE CASCADE,
      "food_id" uuid REFERENCES "foods"("id") ON DELETE SET NULL,
      "amount_grams" numeric(6,2) NOT NULL,
      "calories" numeric(8,2) NOT NULL,
      "protein" numeric(6,2) NOT NULL,
      "carbs" numeric(6,2) NOT NULL,
      "fat" numeric(6,2) NOT NULL,
      "fiber" numeric(6,2) NOT NULL DEFAULT 0,
      "input_method" text NOT NULL
    );
    CREATE TABLE "daily_nutrition_snapshots" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "food_date" date NOT NULL,
      "timezone" varchar(64) NOT NULL,
      "calories" numeric(10,2) NOT NULL DEFAULT 0,
      "protein" numeric(10,2) NOT NULL DEFAULT 0,
      "carbs" numeric(10,2) NOT NULL DEFAULT 0,
      "fat" numeric(10,2) NOT NULL DEFAULT 0,
      "fiber" numeric(10,2) NOT NULL DEFAULT 0,
      "meal_count" integer NOT NULL DEFAULT 0,
      "target_calories" integer,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("user_id", "food_date")
    );
    CREATE TABLE "outbox_events" (
      "id" uuid PRIMARY KEY,
      "aggregate_type" varchar(64) NOT NULL,
      "aggregate_id" uuid NOT NULL,
      "event_type" varchar(100) NOT NULL,
      "deduplication_key" varchar(180) NOT NULL UNIQUE,
      "payload" jsonb NOT NULL DEFAULT '{}',
      "occurred_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "processed_at" timestamptz,
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text
    );
    CREATE TABLE "groups" (
      "id" uuid PRIMARY KEY,
      "creator_id" uuid NOT NULL REFERENCES "users"("id"),
      "name" varchar(100) NOT NULL,
      "description" text,
      "invite_code" varchar(8) NOT NULL UNIQUE,
      "is_private" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "group_members" (
      "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role" text NOT NULL DEFAULT 'MEMBER',
      "joined_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY ("group_id", "user_id")
    );
    CREATE TABLE "feed_posts" (
      "id" uuid PRIMARY KEY,
      "group_id" uuid NOT NULL REFERENCES "groups"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "meal_log_id" uuid REFERENCES "meal_logs"("id") ON DELETE SET NULL,
      "content" text,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE UNIQUE INDEX "feed_posts_group_id_meal_log_id_key"
      ON "feed_posts" ("group_id", "meal_log_id")
      WHERE "meal_log_id" IS NOT NULL;
    CREATE TABLE "post_reactions" (
      "id" uuid PRIMARY KEY,
      "post_id" uuid NOT NULL REFERENCES "feed_posts"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "reaction_type" text NOT NULL,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("post_id", "user_id")
    );
  `);
  return dataSource;
}

export async function resetMealData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "post_reactions"');
  await dataSource.query('DELETE FROM "feed_posts"');
  await dataSource.query('DELETE FROM "group_members"');
  await dataSource.query('DELETE FROM "groups"');
  await dataSource.query('DELETE FROM "outbox_events"');
  await dataSource.query('DELETE FROM "daily_nutrition_snapshots"');
  await dataSource.query('DELETE FROM "meal_log_items"');
  await dataSource.query('DELETE FROM "meal_logs"');
  await resetDietPlanData(dataSource);
}
