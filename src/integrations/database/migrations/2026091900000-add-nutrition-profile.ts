import type { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNutritionProfile2026091900000 implements MigrationInterface {
  name = 'AddNutritionProfile2026091900000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        ADD COLUMN "display_name" varchar(80),
        ADD COLUMN "date_of_birth" date,
        ADD COLUMN "biological_sex" varchar(10),
        ADD COLUMN "goal" varchar(24),
        ADD COLUMN "activity_level" varchar(20),
        ADD COLUMN "target_weight_kg" numeric(6,2),
        ADD COLUMN "target_date" date,
        ADD COLUMN "dietary_restrictions" varchar(1000),
        ADD COLUMN "onboarding_completed" boolean NOT NULL DEFAULT false,
        ADD COLUMN "onboarding_completed_at" timestamptz,
        ADD CONSTRAINT "CHK_user_profiles_biological_sex"
          CHECK ("biological_sex" IS NULL OR "biological_sex" IN ('FEMALE', 'MALE')),
        ADD CONSTRAINT "CHK_user_profiles_goal"
          CHECK ("goal" IS NULL OR "goal" IN ('LOSE_WEIGHT', 'GAIN_MUSCLE', 'GAIN_STRENGTH', 'MAINTAIN', 'PERFORMANCE')),
        ADD CONSTRAINT "CHK_user_profiles_activity_level"
          CHECK ("activity_level" IS NULL OR "activity_level" IN ('SEDENTARY', 'LIGHT', 'MODERATE', 'INTENSE', 'VERY_INTENSE')),
        ADD CONSTRAINT "CHK_user_profiles_target_weight"
          CHECK ("target_weight_kg" IS NULL OR "target_weight_kg" > 0)
    `);

    await queryRunner.query(`
      CREATE TABLE "body_measurements" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "height_cm" numeric(5,2) NOT NULL,
        "weight_kg" numeric(6,2) NOT NULL,
        "measured_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_body_measurements" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_body_measurements_height" CHECK ("height_cm" > 0),
        CONSTRAINT "CHK_body_measurements_weight" CHECK ("weight_kg" > 0),
        CONSTRAINT "FK_body_measurements_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_body_measurements_user_measured_at"
        ON "body_measurements" ("user_id", "measured_at" DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE "user_stats" (
        "id" uuid NOT NULL DEFAULT gen_random_uuid(),
        "user_id" uuid NOT NULL,
        "stat_date" date NOT NULL,
        "age_years" smallint NOT NULL,
        "bmr_kcal_per_day" integer NOT NULL,
        "tdee_kcal_per_day" integer NOT NULL,
        "calorie_target_kcal_per_day" integer NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_stats" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_stats_user_date" UNIQUE ("user_id", "stat_date"),
        CONSTRAINT "CHK_user_stats_age" CHECK ("age_years" >= 18),
        CONSTRAINT "CHK_user_stats_energy" CHECK (
          "bmr_kcal_per_day" > 0 AND
          "tdee_kcal_per_day" >= "bmr_kcal_per_day" AND
          "calorie_target_kcal_per_day" > 0
        ),
        CONSTRAINT "FK_user_stats_user" FOREIGN KEY ("user_id")
          REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "user_stats"');
    await queryRunner.query('DROP INDEX "IDX_body_measurements_user_measured_at"');
    await queryRunner.query('DROP TABLE "body_measurements"');
    await queryRunner.query(`
      ALTER TABLE "user_profiles"
        DROP CONSTRAINT "CHK_user_profiles_target_weight",
        DROP CONSTRAINT "CHK_user_profiles_activity_level",
        DROP CONSTRAINT "CHK_user_profiles_goal",
        DROP CONSTRAINT "CHK_user_profiles_biological_sex",
        DROP COLUMN "onboarding_completed_at",
        DROP COLUMN "onboarding_completed",
        DROP COLUMN "dietary_restrictions",
        DROP COLUMN "target_date",
        DROP COLUMN "target_weight_kg",
        DROP COLUMN "activity_level",
        DROP COLUMN "goal",
        DROP COLUMN "biological_sex",
        DROP COLUMN "date_of_birth",
        DROP COLUMN "display_name"
    `);
  }
}
