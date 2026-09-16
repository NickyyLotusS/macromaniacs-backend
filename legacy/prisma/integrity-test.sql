-- Executar depois de `prisma db seed` em um banco descartável já migrado.
\set ON_ERROR_STOP on

BEGIN;

INSERT INTO "users" ("id", "email", "password_hash", "username", "display_name")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'integrity@example.com',
  'argon2id-test-hash',
  'integrity_user',
  'Integrity User'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "users" ("id", "email", "password_hash", "username", "display_name")
    VALUES (
      '00000000-0000-0000-0000-000000000002',
      'integrity@example.com',
      'argon2id-test-hash',
      'another_user',
      'Duplicate Email'
    );
    RAISE EXCEPTION 'E-mail duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "users" ("id", "email", "password_hash", "username", "display_name")
    VALUES (
      '00000000-0000-0000-0000-000000000003',
      'another@example.com',
      'argon2id-test-hash',
      'integrity_user',
      'Duplicate Username'
    );
    RAISE EXCEPTION 'Username duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "users" ("id", "email", "password_hash", "username", "display_name")
    VALUES (
      '00000000-0000-0000-0000-000000000004',
      'UpperCase@Example.com',
      'argon2id-test-hash',
      'uppercase_user',
      'Non Canonical Email'
    );
    RAISE EXCEPTION 'E-mail não normalizado foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    PERFORM 'INVALID'::"ReactionType";
    RAISE EXCEPTION 'Enum inválido foi aceito.';
  EXCEPTION WHEN invalid_text_representation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "user_profiles" ("user_id", "goal")
    VALUES ('00000000-0000-0000-0000-000000000001', 'MAINTENANCE');
    RAISE EXCEPTION 'Perfil incompleto foi aceito.';
  EXCEPTION WHEN not_null_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "foods" (
      "id", "name", "source", "calories_per_100g", "protein_per_100g",
      "carbs_per_100g", "fat_per_100g"
    ) VALUES (
      '10000000-0000-0000-0000-000000000001', 'Invalid food', 'MANUAL', -1, 0, 0, 0
    );
    RAISE EXCEPTION 'Nutriente negativo foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "point_transactions" ("id", "user_id", "amount", "reason")
    VALUES (
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      0,
      'ADMIN_ADJUSTMENT'
    );
    RAISE EXCEPTION 'Transação de valor zero foi aceita.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;
END $$;

INSERT INTO "user_profiles" (
  "user_id", "birth_date", "biological_sex", "height_cm", "current_weight_kg", "goal", "activity_level"
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  DATE '1990-01-01',
  'NOT_INFORMED',
  175,
  75,
  'MAINTENANCE',
  'MODERATE'
);

INSERT INTO "body_measurements" ("id", "user_id", "weight_kg")
VALUES (
  '30000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  75
);

INSERT INTO "groups" ("id", "creator_id", "name", "invite_code")
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'Integrity Group',
  'TEST1234'
);

INSERT INTO "group_members" ("group_id", "user_id", "role")
VALUES (
  '40000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  'ADMIN'
);

DO $$
BEGIN
  BEGIN
    INSERT INTO "body_measurements" ("id", "user_id", "weight_kg")
    VALUES (
      '30000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000001',
      -1
    );
    RAISE EXCEPTION 'Peso negativo foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "group_challenges" ("id", "group_id", "title", "start_at", "end_at")
    VALUES (
      '50000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      'Invalid dates',
      TIMESTAMPTZ '2026-09-05 10:00:00+00',
      TIMESTAMPTZ '2026-09-04 10:00:00+00'
    );
    RAISE EXCEPTION 'Intervalo de desafio inválido foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "feed_posts" ("id", "group_id", "user_id")
    VALUES (
      '60000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001'
    );
    RAISE EXCEPTION 'Post vazio foi aceito.';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  BEGIN
    DELETE FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Criador de grupo foi removido sem transferência.';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

INSERT INTO "user_achievements" ("user_id", "achievement_id")
SELECT '00000000-0000-0000-0000-000000000001', "id"
FROM "achievements"
WHERE "code" = 'FIRST_MEAL';

DO $$
DECLARE
  achievement_id UUID;
BEGIN
  SELECT "id" INTO achievement_id FROM "achievements" WHERE "code" = 'FIRST_MEAL';

  BEGIN
    DELETE FROM "achievements" WHERE "id" = achievement_id;
    RAISE EXCEPTION 'Achievement referenciado foi removido.';
  EXCEPTION WHEN foreign_key_violation THEN
    NULL;
  END;
END $$;

DELETE FROM "groups" WHERE "id" = '40000000-0000-0000-0000-000000000001';
DELETE FROM "users" WHERE "id" = '00000000-0000-0000-0000-000000000001';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "group_members"
    WHERE "group_id" = '40000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Cascade de group_members não funcionou.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "user_profiles"
    WHERE "user_id" = '00000000-0000-0000-0000-000000000001'
  ) OR EXISTS (
    SELECT 1 FROM "body_measurements"
    WHERE "user_id" = '00000000-0000-0000-0000-000000000001'
  ) THEN
    RAISE EXCEPTION 'Cascade dos dados do usuário não funcionou.';
  END IF;
END $$;

ROLLBACK;
