-- Alinha o banco de dados com as etapas de onboarding definidas no Figma.

-- Renomeia os objetivos existentes sem perder os dados gravados.
ALTER TYPE "UserGoal" RENAME VALUE 'CUTTING' TO 'WEIGHT_LOSS';
ALTER TYPE "UserGoal" RENAME VALUE 'BULKING' TO 'MUSCLE_GAIN';
ALTER TYPE "UserGoal" ADD VALUE IF NOT EXISTS 'STRENGTH_GAIN';
ALTER TYPE "UserGoal" ADD VALUE IF NOT EXISTS 'PERFORMANCE';

-- Restringe o parâmetro biológico às opções aceitas pelo aplicativo.
CREATE TYPE "BiologicalSex" AS ENUM ('FEMALE', 'MALE', 'NOT_INFORMED');

ALTER TABLE "user_profiles"
ADD COLUMN "biological_sex" "BiologicalSex";

UPDATE "user_profiles"
SET "biological_sex" = CASE
  WHEN LOWER(TRIM("gender")) IN ('female', 'feminino', 'f') THEN 'FEMALE'::"BiologicalSex"
  WHEN LOWER(TRIM("gender")) IN ('male', 'masculino', 'm') THEN 'MALE'::"BiologicalSex"
  WHEN "gender" IS NOT NULL THEN 'NOT_INFORMED'::"BiologicalSex"
  ELSE NULL
END;

ALTER TABLE "user_profiles" DROP COLUMN "gender";

-- Restringe o nível de atividade às cinco opções apresentadas no Figma.
CREATE TYPE "ActivityLevel" AS ENUM (
  'SEDENTARY',
  'LIGHT',
  'MODERATE',
  'INTENSE',
  'VERY_INTENSE'
);

ALTER TABLE "user_profiles"
ADD COLUMN "activity_level_new" "ActivityLevel";

UPDATE "user_profiles"
SET "activity_level_new" = CASE
  WHEN LOWER(TRIM("activity_level")) IN ('sedentary', 'sedentário', 'sedentario') THEN 'SEDENTARY'::"ActivityLevel"
  WHEN LOWER(TRIM("activity_level")) IN ('light', 'leve') THEN 'LIGHT'::"ActivityLevel"
  WHEN LOWER(TRIM("activity_level")) IN ('moderate', 'moderado') THEN 'MODERATE'::"ActivityLevel"
  WHEN LOWER(TRIM("activity_level")) IN ('intense', 'intenso') THEN 'INTENSE'::"ActivityLevel"
  WHEN LOWER(TRIM("activity_level")) IN ('very_intense', 'very intense', 'muito intenso') THEN 'VERY_INTENSE'::"ActivityLevel"
  ELSE NULL
END;

ALTER TABLE "user_profiles" DROP COLUMN "activity_level";
ALTER TABLE "user_profiles" RENAME COLUMN "activity_level_new" TO "activity_level";

-- Campos da etapa opcional do perfil.
ALTER TABLE "user_profiles"
ADD COLUMN "target_weight_kg" DECIMAL(5,2),
ADD COLUMN "target_date" DATE,
ADD COLUMN "dietary_restrictions_note" TEXT;

-- Restrições básicas para impedir medidas inválidas no banco.
ALTER TABLE "user_profiles"
ADD CONSTRAINT "user_profiles_height_cm_check"
  CHECK ("height_cm" IS NULL OR "height_cm" > 0),
ADD CONSTRAINT "user_profiles_current_weight_kg_check"
  CHECK ("current_weight_kg" IS NULL OR "current_weight_kg" > 0),
ADD CONSTRAINT "user_profiles_target_weight_kg_check"
  CHECK ("target_weight_kg" IS NULL OR "target_weight_kg" > 0);
