-- Consolida o schema definitivo do escopo atual sem descartar dados existentes.
-- CHECK constraints são mantidas em SQL porque o Prisma 5 não as representa no schema.prisma.

BEGIN;

-- Interrompe a migration antes de qualquer DDL destrutivo se houver dados incompatíveis.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "user_profiles"
    WHERE "birth_date" IS NULL
       OR "biological_sex" IS NULL
       OR "height_cm" IS NULL
       OR "current_weight_kg" IS NULL
       OR "activity_level" IS NULL
  ) THEN
    RAISE EXCEPTION 'Existem perfis incompletos; finalize ou remova esses perfis antes da migration.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "diet_plans"
    WHERE UPPER(TRIM("status")) NOT IN ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED')
  ) THEN
    RAISE EXCEPTION 'diet_plans.status contém valor não mapeado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "group_challenges"
    WHERE UPPER(TRIM("status")) NOT IN ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED')
  ) THEN
    RAISE EXCEPTION 'group_challenges.status contém valor não mapeado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "post_reactions"
    WHERE UPPER(TRIM("reaction_type")) NOT IN ('LIKE', 'FIRE', 'CLAP')
  ) THEN
    RAISE EXCEPTION 'post_reactions.reaction_type contém valor não mapeado.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "point_transactions"
    WHERE UPPER(TRIM("reason")) NOT IN (
      'DAILY_MISSION_COMPLETED',
      'QUEST_COMPLETED',
      'ACHIEVEMENT_UNLOCKED',
      'MEAL_LOG_STREAK',
      'COSMETIC_PURCHASE',
      'AVATAR_PURCHASE',
      'ADMIN_ADJUSTMENT'
    )
  ) THEN
    RAISE EXCEPTION 'point_transactions.reason contém valor não mapeado.';
  END IF;

  IF EXISTS (
    SELECT LOWER(BTRIM("email"))
    FROM "users"
    GROUP BY LOWER(BTRIM("email"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem e-mails duplicados após normalização case-insensitive.';
  END IF;

  IF EXISTS (
    SELECT LOWER(BTRIM("username"))
    FROM "users"
    GROUP BY LOWER(BTRIM("username"))
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem usernames duplicados após normalização case-insensitive.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "foods"
    WHERE "external_id" IS NOT NULL
    GROUP BY "source", "external_id"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem alimentos duplicados por source/external_id.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "planned_meals"
    GROUP BY "diet_plan_id", "order_index"
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION 'Existem posições duplicadas em planned_meals.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "groups" AS g
    WHERE NOT EXISTS (
      SELECT 1 FROM "group_members" AS gm WHERE gm."group_id" = g."id"
    )
  ) THEN
    RAISE EXCEPTION 'Existem grupos sem membros; não é possível definir creator_id.';
  END IF;
END $$;

-- Novos domínios fechados.
CREATE TYPE "DietPlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "GroupChallengeStatus" AS ENUM ('SCHEDULED', 'ACTIVE', 'COMPLETED', 'CANCELLED');
CREATE TYPE "ReactionType" AS ENUM ('LIKE', 'FIRE', 'CLAP');
CREATE TYPE "PointTransactionReason" AS ENUM (
  'DAILY_MISSION_COMPLETED',
  'ACHIEVEMENT_UNLOCKED',
  'MEAL_LOG_STREAK',
  'COSMETIC_PURCHASE',
  'ADMIN_ADJUSTMENT'
);

-- Identidade canônica: unicidade simples do Prisma passa a ser também case-insensitive.
UPDATE "users"
SET "email" = LOWER(BTRIM("email")),
    "username" = LOWER(BTRIM("username"));

ALTER TABLE "users"
ADD CONSTRAINT "users_email_format_check"
  CHECK ("email" = LOWER(BTRIM("email")) AND "email" ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'),
ADD CONSTRAINT "users_username_format_check"
  CHECK ("username" = LOWER(BTRIM("username")) AND "username" ~ '^[a-z0-9_]{3,50}$'),
ADD CONSTRAINT "users_display_name_not_blank_check"
  CHECK (LENGTH(BTRIM("display_name")) > 0),
ADD CONSTRAINT "users_password_hash_not_blank_check"
  CHECK (LENGTH(BTRIM("password_hash")) > 0);

-- Auditoria e obrigatoriedade do perfil criado ao fim do onboarding.
ALTER TABLE "user_profiles"
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "birth_date" SET NOT NULL,
ALTER COLUMN "height_cm" SET NOT NULL,
ALTER COLUMN "current_weight_kg" SET NOT NULL,
ALTER COLUMN "goal" DROP DEFAULT,
ALTER COLUMN "biological_sex" SET NOT NULL,
ALTER COLUMN "activity_level" SET NOT NULL,
ADD CONSTRAINT "user_profiles_birth_date_check"
  CHECK ("birth_date" <= CURRENT_DATE),
ADD CONSTRAINT "user_profiles_target_date_check"
  CHECK ("target_date" IS NULL OR "target_date" > "birth_date"),
ADD CONSTRAINT "user_profiles_dietary_note_check"
  CHECK ("dietary_restrictions_note" IS NULL OR LENGTH(BTRIM("dietary_restrictions_note")) > 0),
ADD CONSTRAINT "user_profiles_avatar_config_check"
  CHECK (JSONB_TYPEOF("avatar_config") = 'object');

-- As três constraints de medidas abaixo foram criadas pela migration anterior e são preservadas:
-- user_profiles_height_cm_check, user_profiles_current_weight_kg_check e
-- user_profiles_target_weight_kg_check.

ALTER TABLE "body_measurements"
ADD CONSTRAINT "body_measurements_weight_kg_check" CHECK ("weight_kg" > 0);

CREATE INDEX "body_measurements_user_id_measured_at_idx"
ON "body_measurements"("user_id", "measured_at" DESC);

ALTER TABLE "user_stats"
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "user_stats_streaks_check"
  CHECK ("current_streak" >= 0 AND "best_streak" >= "current_streak"),
ADD CONSTRAINT "user_stats_total_points_check" CHECK ("total_points" >= 0);

-- Catálogo nutricional.
ALTER TABLE "foods"
ADD CONSTRAINT "foods_name_not_blank_check" CHECK (LENGTH(BTRIM("name")) > 0),
ADD CONSTRAINT "foods_external_id_check"
  CHECK ("external_id" IS NULL OR LENGTH(BTRIM("external_id")) > 0),
ADD CONSTRAINT "foods_barcode_check"
  CHECK ("barcode" IS NULL OR LENGTH(BTRIM("barcode")) > 0),
ADD CONSTRAINT "foods_nutrients_check" CHECK (
  "calories_per_100g" >= 0
  AND "protein_per_100g" >= 0
  AND "carbs_per_100g" >= 0
  AND "fat_per_100g" >= 0
  AND "fiber_per_100g" >= 0
),
ADD CONSTRAINT "foods_serving_size_g_check" CHECK ("serving_size_g" > 0);

CREATE UNIQUE INDEX "foods_source_external_id_key" ON "foods"("source", "external_id");

-- Planos e refeições planejadas.
ALTER TABLE "diet_plans" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "diet_plans"
ALTER COLUMN "status" TYPE "DietPlanStatus"
USING UPPER(TRIM("status"))::"DietPlanStatus";
ALTER TABLE "diet_plans"
ALTER COLUMN "status" SET DEFAULT 'ACTIVE',
ADD CONSTRAINT "diet_plans_title_not_blank_check" CHECK (LENGTH(BTRIM("title")) > 0),
ADD CONSTRAINT "diet_plans_targets_check" CHECK (
  "target_calories" > 0
  AND "target_protein" >= 0
  AND "target_carbs" >= 0
  AND "target_fat" >= 0
  AND "target_fiber" >= 0
),
ADD CONSTRAINT "diet_plans_date_range_check"
  CHECK ("start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date");

CREATE INDEX "diet_plans_user_id_status_idx" ON "diet_plans"("user_id", "status");

ALTER TABLE "planned_meals"
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "planned_meals_name_not_blank_check" CHECK (LENGTH(BTRIM("name")) > 0),
ADD CONSTRAINT "planned_meals_order_index_check" CHECK ("order_index" > 0),
ADD CONSTRAINT "planned_meals_targets_check" CHECK (
  ("target_calories" IS NULL OR "target_calories" >= 0)
  AND ("target_protein" IS NULL OR "target_protein" >= 0)
  AND ("target_carbs" IS NULL OR "target_carbs" >= 0)
  AND ("target_fat" IS NULL OR "target_fat" >= 0)
);

CREATE UNIQUE INDEX "planned_meals_diet_plan_id_order_index_key"
ON "planned_meals"("diet_plan_id", "order_index");

ALTER TABLE "planned_meal_items"
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "calories" TYPE DECIMAL(8,2) USING "calories"::DECIMAL(8,2),
ADD CONSTRAINT "planned_meal_items_amount_check" CHECK ("amount_grams" > 0),
ADD CONSTRAINT "planned_meal_items_nutrients_check" CHECK (
  "calories" >= 0
  AND "protein" >= 0
  AND "carbs" >= 0
  AND "fat" >= 0
  AND "fiber" >= 0
);

CREATE INDEX "planned_meal_items_planned_meal_id_idx" ON "planned_meal_items"("planned_meal_id");
CREATE INDEX "planned_meal_items_food_id_idx" ON "planned_meal_items"("food_id");

-- Diário alimentar.
ALTER TABLE "meal_logs"
ADD CONSTRAINT "meal_logs_name_not_blank_check" CHECK (LENGTH(BTRIM("name")) > 0),
ADD CONSTRAINT "meal_logs_photo_url_check"
  CHECK ("photo_url" IS NULL OR LENGTH(BTRIM("photo_url")) > 0);

CREATE INDEX "meal_logs_planned_meal_id_idx" ON "meal_logs"("planned_meal_id");

ALTER TABLE "meal_log_items"
ALTER COLUMN "calories" TYPE DECIMAL(8,2) USING "calories"::DECIMAL(8,2),
ADD CONSTRAINT "meal_log_items_amount_check" CHECK ("amount_grams" > 0),
ADD CONSTRAINT "meal_log_items_nutrients_check" CHECK (
  "calories" >= 0
  AND "protein" >= 0
  AND "carbs" >= 0
  AND "fat" >= 0
  AND "fiber" >= 0
);

CREATE INDEX "meal_log_items_meal_log_id_idx" ON "meal_log_items"("meal_log_id");
CREATE INDEX "meal_log_items_food_id_idx" ON "meal_log_items"("food_id");

-- Grupos e conteúdo social.
ALTER TABLE "groups"
ADD COLUMN "creator_id" UUID,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "groups" AS g
SET "creator_id" = COALESCE(
  (
    SELECT gm."user_id"
    FROM "group_members" AS gm
    WHERE gm."group_id" = g."id" AND gm."role" = 'ADMIN'
    ORDER BY gm."joined_at", gm."user_id"
    LIMIT 1
  ),
  (
    SELECT gm."user_id"
    FROM "group_members" AS gm
    WHERE gm."group_id" = g."id"
    ORDER BY gm."joined_at", gm."user_id"
    LIMIT 1
  )
);

UPDATE "group_members" AS gm
SET "role" = 'ADMIN'
FROM "groups" AS g
WHERE g."id" = gm."group_id"
  AND g."creator_id" = gm."user_id"
  AND gm."role" <> 'ADMIN';

ALTER TABLE "groups"
ALTER COLUMN "creator_id" SET NOT NULL,
ADD CONSTRAINT "groups_name_not_blank_check" CHECK (LENGTH(BTRIM("name")) > 0),
ADD CONSTRAINT "groups_invite_code_check" CHECK ("invite_code" ~ '^[A-Z0-9]{8}$');

CREATE INDEX "groups_creator_id_idx" ON "groups"("creator_id");
CREATE INDEX "group_members_user_id_idx" ON "group_members"("user_id");

ALTER TABLE "group_challenges" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "group_challenges"
ALTER COLUMN "status" TYPE "GroupChallengeStatus"
USING UPPER(TRIM("status"))::"GroupChallengeStatus";
ALTER TABLE "group_challenges"
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "status" SET DEFAULT 'SCHEDULED',
ADD CONSTRAINT "group_challenges_title_not_blank_check" CHECK (LENGTH(BTRIM("title")) > 0),
ADD CONSTRAINT "group_challenges_date_range_check" CHECK ("end_at" > "start_at");

CREATE INDEX "group_challenges_group_id_status_start_at_idx"
ON "group_challenges"("group_id", "status", "start_at");

ALTER TABLE "feed_posts"
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "feed_posts_content_check"
  CHECK ("meal_log_id" IS NOT NULL OR ("content" IS NOT NULL AND LENGTH(BTRIM("content")) > 0));

CREATE INDEX "feed_posts_group_id_created_at_idx" ON "feed_posts"("group_id", "created_at" DESC);
CREATE INDEX "feed_posts_user_id_created_at_idx" ON "feed_posts"("user_id", "created_at" DESC);
CREATE INDEX "feed_posts_meal_log_id_idx" ON "feed_posts"("meal_log_id");

ALTER TABLE "post_reactions"
ALTER COLUMN "reaction_type" TYPE "ReactionType"
USING UPPER(TRIM("reaction_type"))::"ReactionType";

CREATE INDEX "post_reactions_user_id_idx" ON "post_reactions"("user_id");

ALTER TABLE "chat_messages"
ADD CONSTRAINT "chat_messages_message_not_blank_check" CHECK (LENGTH(BTRIM("message")) > 0);

CREATE INDEX "chat_messages_group_id_created_at_idx" ON "chat_messages"("group_id", "created_at" DESC);
CREATE INDEX "chat_messages_user_id_idx" ON "chat_messages"("user_id");

-- Ledger: preserva referências antigas dentro de metadata antes de remover as colunas polimórficas.
ALTER TABLE "point_transactions"
ADD COLUMN "metadata" JSONB NOT NULL DEFAULT '{}';

UPDATE "point_transactions"
SET "metadata" = JSONB_STRIP_NULLS(
  JSONB_BUILD_OBJECT(
    'referenceType', "reference_type",
    'referenceId', "reference_id"
  )
);

ALTER TABLE "point_transactions"
ALTER COLUMN "reason" TYPE "PointTransactionReason"
USING (
  CASE UPPER(TRIM("reason"))
    WHEN 'QUEST_COMPLETED' THEN 'DAILY_MISSION_COMPLETED'
    WHEN 'AVATAR_PURCHASE' THEN 'COSMETIC_PURCHASE'
    ELSE UPPER(TRIM("reason"))
  END
)::"PointTransactionReason",
DROP COLUMN "reference_type",
DROP COLUMN "reference_id",
ADD CONSTRAINT "point_transactions_amount_check" CHECK ("amount" <> 0),
ADD CONSTRAINT "point_transactions_metadata_check" CHECK (JSONB_TYPEOF("metadata") = 'object');

CREATE INDEX "point_transactions_user_id_created_at_idx"
ON "point_transactions"("user_id", "created_at" DESC);

-- Catálogos de gamificação e loja.
ALTER TABLE "achievements"
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD CONSTRAINT "achievements_code_check" CHECK ("code" ~ '^[A-Z0-9_]{2,50}$'),
ADD CONSTRAINT "achievements_title_not_blank_check" CHECK (LENGTH(BTRIM("title")) > 0);

ALTER TABLE "daily_missions"
ADD COLUMN "code" VARCHAR(50),
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH ranked AS (
  SELECT "id", "title", ROW_NUMBER() OVER (PARTITION BY "title" ORDER BY "id") AS occurrence
  FROM "daily_missions"
)
UPDATE "daily_missions" AS mission
SET "code" = CASE
  WHEN ranked."title" = 'Registrar 3 refeições hoje' AND ranked.occurrence = 1 THEN 'LOG_THREE_MEALS'
  WHEN ranked."title" = 'Bater a meta diária de proteína' AND ranked.occurrence = 1 THEN 'HIT_PROTEIN_TARGET'
  WHEN ranked."title" = 'Reagir ao post de um amigo no feed' AND ranked.occurrence = 1 THEN 'REACT_TO_FRIEND_POST'
  ELSE 'LEGACY_' || REPLACE(mission."id"::TEXT, '-', '')
END
FROM ranked
WHERE ranked."id" = mission."id";

ALTER TABLE "daily_missions"
ALTER COLUMN "code" SET NOT NULL,
ADD CONSTRAINT "daily_missions_code_check" CHECK ("code" ~ '^[A-Z0-9_]{2,50}$'),
ADD CONSTRAINT "daily_missions_title_not_blank_check" CHECK (LENGTH(BTRIM("title")) > 0),
ADD CONSTRAINT "daily_missions_target_count_check" CHECK ("target_count" > 0),
ADD CONSTRAINT "daily_missions_points_reward_check" CHECK ("points_reward" >= 0);

CREATE UNIQUE INDEX "daily_missions_code_key" ON "daily_missions"("code");

ALTER TABLE "user_daily_missions"
ALTER COLUMN "date" DROP DEFAULT,
ADD CONSTRAINT "user_daily_missions_progress_check" CHECK ("current_progress" >= 0);

CREATE INDEX "user_daily_missions_mission_id_date_idx"
ON "user_daily_missions"("mission_id", "date");

ALTER TABLE "cosmetic_items"
ADD COLUMN "code" VARCHAR(50),
ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

WITH ranked AS (
  SELECT "id", "asset_url", ROW_NUMBER() OVER (PARTITION BY "asset_url" ORDER BY "id") AS occurrence
  FROM "cosmetic_items"
)
UPDATE "cosmetic_items" AS item
SET "code" = CASE
  WHEN ranked."asset_url" = 'tag_carbo_master' AND ranked.occurrence = 1 THEN 'CARB_MASTER_TAG'
  WHEN ranked."asset_url" = 'tag_frango' AND ranked.occurrence = 1 THEN 'GYM_CHICKEN_TAG'
  WHEN ranked."asset_url" = 'frame_purple_legend' AND ranked.occurrence = 1 THEN 'LEGENDARY_PURPLE_FRAME'
  ELSE 'LEGACY_' || REPLACE(item."id"::TEXT, '-', '')
END
FROM ranked
WHERE ranked."id" = item."id";

ALTER TABLE "cosmetic_items"
ALTER COLUMN "code" SET NOT NULL,
ADD CONSTRAINT "cosmetic_items_code_check" CHECK ("code" ~ '^[A-Z0-9_]{2,50}$'),
ADD CONSTRAINT "cosmetic_items_name_not_blank_check" CHECK (LENGTH(BTRIM("name")) > 0),
ADD CONSTRAINT "cosmetic_items_price_check" CHECK ("price" >= 0),
ADD CONSTRAINT "cosmetic_items_asset_url_check" CHECK (LENGTH(BTRIM("asset_url")) > 0);

CREATE UNIQUE INDEX "cosmetic_items_code_key" ON "cosmetic_items"("code");

-- Índices reversos das relações N:N.
CREATE INDEX "user_achievements_achievement_id_idx" ON "user_achievements"("achievement_id");
CREATE INDEX "user_cosmetics_cosmetic_item_id_idx" ON "user_cosmetics"("cosmetic_item_id");

-- Catálogos referenciados não podem ser removidos enquanto houver histórico associado.
ALTER TABLE "user_achievements" DROP CONSTRAINT "user_achievements_achievement_id_fkey";
ALTER TABLE "user_daily_missions" DROP CONSTRAINT "user_daily_missions_mission_id_fkey";
ALTER TABLE "user_cosmetics" DROP CONSTRAINT "user_cosmetics_cosmetic_item_id_fkey";

ALTER TABLE "groups"
ADD CONSTRAINT "groups_creator_id_fkey"
FOREIGN KEY ("creator_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_achievements"
ADD CONSTRAINT "user_achievements_achievement_id_fkey"
FOREIGN KEY ("achievement_id") REFERENCES "achievements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_daily_missions"
ADD CONSTRAINT "user_daily_missions_mission_id_fkey"
FOREIGN KEY ("mission_id") REFERENCES "daily_missions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "user_cosmetics"
ADD CONSTRAINT "user_cosmetics_cosmetic_item_id_fkey"
FOREIGN KEY ("cosmetic_item_id") REFERENCES "cosmetic_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
