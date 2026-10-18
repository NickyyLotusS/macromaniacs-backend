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
  `);
  return dataSource;
}

export async function resetDietPlanData(dataSource: DataSource): Promise<void> {
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
