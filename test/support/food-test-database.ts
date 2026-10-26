import type { DataSource } from 'typeorm';
import { createIdentityTestDataSource } from './identity-test-database';

export async function createFoodTestDataSource(): Promise<DataSource> {
  const dataSource = await createIdentityTestDataSource();
  await dataSource.query(`
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
      "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "foods_source_external_id_key" UNIQUE ("source", "external_id"),
      CONSTRAINT "foods_barcode_key" UNIQUE ("barcode")
    );
  `);
  return dataSource;
}

export async function clearFoodData(dataSource: DataSource): Promise<void> {
  await dataSource.query('DELETE FROM "foods"');
}
