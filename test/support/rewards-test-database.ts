import type { DataSource } from 'typeorm';
import {
  createGamificationTestDataSource,
  resetGamificationData,
} from './gamification-test-database';

export async function createRewardsTestDataSource(): Promise<DataSource> {
  const dataSource = await createGamificationTestDataSource();
  await dataSource.query(`
    CREATE TABLE "cosmetic_items" (
      "id" uuid PRIMARY KEY,
      "code" varchar(50) NOT NULL UNIQUE,
      "name" varchar(100) NOT NULL,
      "description" text,
      "type" text NOT NULL,
      "price" integer NOT NULL,
      "asset_url" varchar(500) NOT NULL,
      "is_active" boolean NOT NULL DEFAULT true,
      "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE "user_cosmetics" (
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "cosmetic_item_id" uuid NOT NULL REFERENCES "cosmetic_items"("id"),
      "acquired_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "is_equipped" boolean NOT NULL DEFAULT false,
      PRIMARY KEY ("user_id", "cosmetic_item_id")
    );
    INSERT INTO "cosmetic_items"
      ("id", "code", "name", "type", "price", "asset_url") VALUES
      ('40000000-0000-4000-8000-000000000001', 'TAG_ONE', 'Tag Um', 'TAG', 50, 'tag_one'),
      ('40000000-0000-4000-8000-000000000002', 'TAG_TWO', 'Tag Dois', 'TAG', 75, 'tag_two');
  `);
  return dataSource;
}

export async function resetRewardsData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "user_cosmetics"');
  await resetGamificationData(dataSource);
}
