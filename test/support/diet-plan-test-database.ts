import type { DataSource } from 'typeorm';
import {
  clearIdentityData,
  createIdentityTestDataSource,
} from './identity-test-database';

export const dietPlanTestUsers = {
  owner: '10000000-0000-4000-8000-000000000001',
  stranger: '10000000-0000-4000-8000-000000000002',
} as const;

export async function createDietPlanTestDataSource(): Promise<DataSource> {
  const dataSource = await createIdentityTestDataSource();
  await dataSource.query(`
    CREATE TABLE "diet_plans" (
      "id" uuid PRIMARY KEY,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "title" varchar(100) NOT NULL,
      "status" text NOT NULL DEFAULT 'ACTIVE',
      "target_calories" integer NOT NULL,
      "target_protein" numeric(6,2) NOT NULL,
      "target_carbs" numeric(6,2) NOT NULL,
      "target_fat" numeric(6,2) NOT NULL,
      "target_fiber" numeric(6,2) NOT NULL DEFAULT 0,
      "start_date" date,
      "end_date" date,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX "diet_plans_user_id_status_idx"
      ON "diet_plans" ("user_id", "status");
    CREATE TABLE "foods" (
      "id" uuid PRIMARY KEY,
      "name" varchar(255) NOT NULL,
      "source" text NOT NULL,
      "external_id" varchar(100),
      "barcode" varchar(100),
      "calories_per_100g" numeric(6,2) NOT NULL,
      "protein_per_100g" numeric(6,2) NOT NULL,
      "carbs_per_100g" numeric(6,2) NOT NULL,
      "fat_per_100g" numeric(6,2) NOT NULL,
      "fiber_per_100g" numeric(6,2) NOT NULL DEFAULT 0,
      "serving_size_g" numeric(6,2) NOT NULL DEFAULT 100,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "planned_meals" (
      "id" uuid PRIMARY KEY,
      "diet_plan_id" uuid NOT NULL REFERENCES "diet_plans"("id") ON DELETE CASCADE,
      "name" varchar(100) NOT NULL,
      "order_index" integer NOT NULL DEFAULT 1,
      "target_calories" integer,
      "target_protein" numeric(6,2),
      "target_carbs" numeric(6,2),
      "target_fat" numeric(6,2),
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE ("diet_plan_id", "order_index")
    );
    CREATE TABLE "planned_meal_items" (
      "id" uuid PRIMARY KEY,
      "planned_meal_id" uuid NOT NULL REFERENCES "planned_meals"("id") ON DELETE CASCADE,
      "food_id" uuid REFERENCES "foods"("id") ON DELETE SET NULL,
      "amount_grams" numeric(6,2) NOT NULL,
      "calories" numeric(8,2) NOT NULL,
      "protein" numeric(6,2) NOT NULL,
      "carbs" numeric(6,2) NOT NULL,
      "fat" numeric(6,2) NOT NULL,
      "fiber" numeric(6,2) NOT NULL DEFAULT 0,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return dataSource;
}

export async function resetDietPlanData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "planned_meal_items"');
  await dataSource.query('DELETE FROM "planned_meals"');
  await dataSource.query('DELETE FROM "foods"');
  await dataSource.query('DELETE FROM "diet_plans"');
  await clearIdentityData(dataSource);
  await dataSource.query(
    `INSERT INTO "users"
      ("id", "email", "password_hash", "username", "display_name")
     VALUES
      ($1, 'owner@example.com', 'test-hash', 'owner', 'Owner'),
      ($2, 'stranger@example.com', 'test-hash', 'stranger', 'Stranger')`,
    [dietPlanTestUsers.owner, dietPlanTestUsers.stranger],
  );
}
