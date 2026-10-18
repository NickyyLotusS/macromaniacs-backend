-- Executar depois do seed TypeORM em banco descartável. Nenhuma alteração persiste.
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

-- Metadados e casos adicionais do contrato definitivo.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_tables WHERE schemaname='public' AND tablename NOT IN ('_prisma_migrations','migrations')) <> 23 THEN
    RAISE EXCEPTION 'Esperadas 23 tabelas de domínio.';
  END IF;
  IF (SELECT count(*) FROM pg_constraint WHERE connamespace='public'::regnamespace AND contype='c') <> 50 THEN
    RAISE EXCEPTION 'Esperadas 50 CHECK constraints.';
  END IF;
  BEGIN
    UPDATE users SET username='UpperCase' WHERE id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Username não canônico foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET height_cm=0 WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Altura zero foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET current_weight_kg=-1 WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Peso atual negativo foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET target_weight_kg=0 WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Peso alvo zero foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET birth_date=CURRENT_DATE+1 WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Nascimento futuro foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET target_date=birth_date WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Data alvo incoerente foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE user_profiles SET avatar_config='[]' WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Avatar não objeto foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE groups SET invite_code='bad_code' WHERE id='40000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Convite inválido foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    INSERT INTO groups(id,creator_id,name,invite_code) VALUES('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','Duplicate invite','TEST1234');
    RAISE EXCEPTION 'Convite duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO group_members(group_id,user_id) VALUES('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
    RAISE EXCEPTION 'Vínculo de grupo duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO chat_messages(id,group_id,user_id,message) VALUES('61000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','  ');
    RAISE EXCEPTION 'Mensagem vazia foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO user_stats(user_id,total_points) VALUES('00000000-0000-0000-0000-000000000001',0);
INSERT INTO point_transactions(id,user_id,amount,reason,metadata) VALUES
 ('21000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',30,'ADMIN_ADJUSTMENT','{"test":true}'),
 ('21000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',-10,'COSMETIC_PURCHASE','{}');
UPDATE user_stats SET total_points=20 WHERE user_id='00000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT total_points FROM user_stats WHERE user_id='00000000-0000-0000-0000-000000000001') <> (SELECT sum(amount) FROM point_transactions WHERE user_id='00000000-0000-0000-0000-000000000001') THEN
    RAISE EXCEPTION 'Saldo não corresponde ao ledger.';
  END IF;
  BEGIN
    UPDATE user_stats SET total_points=-1 WHERE user_id='00000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Saldo negativo foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE point_transactions SET metadata='[]' WHERE id='21000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Metadata não objeto foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;

INSERT INTO foods(id,name,source,external_id,calories_per_100g,protein_per_100g,carbs_per_100g,fat_per_100g)
VALUES('11000000-0000-0000-0000-000000000001','Snapshot food','MANUAL','snapshot',100.50,10,20,1);
INSERT INTO diet_plans(id,user_id,title,target_calories,target_protein,target_carbs,target_fat)
VALUES('12000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Test diet',2000,150,200,60);
INSERT INTO planned_meals(id,diet_plan_id,name) VALUES('13000000-0000-0000-0000-000000000001','12000000-0000-0000-0000-000000000001','Test meal');
INSERT INTO planned_meal_items(id,planned_meal_id,food_id,amount_grams,calories,protein,carbs,fat)
VALUES('14000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',50,50.25,5,10,0.50);
INSERT INTO meal_logs(id,user_id,planned_meal_id,name) VALUES('15000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','13000000-0000-0000-0000-000000000001','Test consumed');
INSERT INTO meal_log_items(id,meal_log_id,food_id,amount_grams,calories,protein,carbs,fat,input_method)
VALUES('16000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001','11000000-0000-0000-0000-000000000001',50,50.25,5,10,0.50,'PLANNED_MEAL');
DO $$ BEGIN
  BEGIN
    UPDATE diet_plans SET start_date=DATE '2026-09-20',end_date=DATE '2026-09-01' WHERE id='12000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Datas de dieta incoerentes foram aceitas.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE meal_log_items SET protein=-1 WHERE id='16000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Snapshot negativo foi aceito.';
  EXCEPTION WHEN check_violation THEN NULL; END;
  BEGIN
    UPDATE planned_meal_items SET amount_grams=0 WHERE id='14000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'Quantidade zero foi aceita.';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE foods SET calories_per_100g=999 WHERE id='11000000-0000-0000-0000-000000000001';
DELETE FROM foods WHERE id='11000000-0000-0000-0000-000000000001';
DELETE FROM planned_meals WHERE id='13000000-0000-0000-0000-000000000001';
DO $$ BEGIN
  IF (SELECT calories FROM meal_log_items WHERE id='16000000-0000-0000-0000-000000000001') <> 50.25 OR
     (SELECT food_id FROM meal_log_items WHERE id='16000000-0000-0000-0000-000000000001') IS NOT NULL OR
     (SELECT planned_meal_id FROM meal_logs WHERE id='15000000-0000-0000-0000-000000000001') IS NOT NULL THEN
    RAISE EXCEPTION 'Snapshots e SET NULL não foram preservados.';
  END IF;
END $$;
INSERT INTO feed_posts(id,group_id,user_id,meal_log_id,content) VALUES('62000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','15000000-0000-0000-0000-000000000001',NULL);
DO $$ BEGIN
  BEGIN
    DELETE FROM meal_logs WHERE id='15000000-0000-0000-0000-000000000001';
    RAISE EXCEPTION 'SET NULL deixou um post vazio.';
  EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
UPDATE feed_posts SET content='Snapshot remains' WHERE id='62000000-0000-0000-0000-000000000001';
DELETE FROM meal_logs WHERE id='15000000-0000-0000-0000-000000000001';

INSERT INTO user_daily_missions(user_id,mission_id,date) SELECT '00000000-0000-0000-0000-000000000001',id,DATE '2026-09-15' FROM daily_missions WHERE code='LOG_THREE_MEALS';
INSERT INTO user_cosmetics(user_id,cosmetic_item_id) SELECT '00000000-0000-0000-0000-000000000001',id FROM cosmetic_items WHERE code='CARB_MASTER_TAG';
DO $$ BEGIN
  BEGIN
    INSERT INTO user_achievements(user_id,achievement_id) SELECT '00000000-0000-0000-0000-000000000001',id FROM achievements WHERE code='FIRST_MEAL';
    RAISE EXCEPTION 'Conquista duplicada foi aceita.';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO user_daily_missions(user_id,mission_id,date) SELECT '00000000-0000-0000-0000-000000000001',id,DATE '2026-09-15' FROM daily_missions WHERE code='LOG_THREE_MEALS';
    RAISE EXCEPTION 'Missão diária duplicada foi aceita.';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    INSERT INTO user_cosmetics(user_id,cosmetic_item_id) SELECT '00000000-0000-0000-0000-000000000001',id FROM cosmetic_items WHERE code='CARB_MASTER_TAG';
    RAISE EXCEPTION 'Cosmético duplicado foi aceito.';
  EXCEPTION WHEN unique_violation THEN NULL; END;
  BEGIN
    DELETE FROM daily_missions WHERE code='LOG_THREE_MEALS';
    RAISE EXCEPTION 'Missão referenciada foi removida.';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  BEGIN
    DELETE FROM cosmetic_items WHERE code='CARB_MASTER_TAG';
    RAISE EXCEPTION 'Cosmético referenciado foi removido.';
  EXCEPTION WHEN foreign_key_violation THEN NULL; END;
  IF NOT EXISTS (SELECT 1 FROM groups g JOIN group_members gm ON gm.group_id=g.id AND gm.user_id=g.creator_id WHERE g.id='40000000-0000-0000-0000-000000000001' AND gm.role='ADMIN') THEN
    RAISE EXCEPTION 'Grupo não foi criado com proprietário ADMIN.';
  END IF;
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
