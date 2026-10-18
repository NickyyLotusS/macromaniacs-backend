-- Fixture para um banco descartável com as três migrations anteriores já aplicadas.
\set ON_ERROR_STOP on

INSERT INTO "users" ("id", "email", "password_hash", "username", "display_name")
VALUES (
  '70000000-0000-0000-0000-000000000001',
  'legacy@example.com',
  'argon2id-legacy-hash',
  'legacy_user',
  'Legacy User'
);

INSERT INTO "user_profiles" (
  "user_id", "birth_date", "biological_sex", "height_cm", "current_weight_kg", "goal", "activity_level"
) VALUES (
  '70000000-0000-0000-0000-000000000001',
  DATE '1990-01-01',
  'NOT_INFORMED',
  175,
  75,
  'MAINTENANCE',
  'MODERATE'
);

INSERT INTO "diet_plans" (
  "id", "user_id", "title", "status", "target_calories", "target_protein", "target_carbs", "target_fat"
) VALUES (
  '71000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'Legacy plan',
  'ACTIVE',
  2000,
  150,
  200,
  60
);

INSERT INTO "groups" ("id", "name", "invite_code")
VALUES ('72000000-0000-0000-0000-000000000001', 'Legacy group', 'LEGACY01');

INSERT INTO "group_members" ("group_id", "user_id", "role")
VALUES (
  '72000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'ADMIN'
);

INSERT INTO "group_challenges" ("id", "group_id", "title", "start_at", "end_at", "status")
VALUES (
  '73000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  'Legacy challenge',
  TIMESTAMPTZ '2026-09-01 10:00:00+00',
  TIMESTAMPTZ '2026-09-10 10:00:00+00',
  'ACTIVE'
);

INSERT INTO "feed_posts" ("id", "group_id", "user_id", "content")
VALUES (
  '74000000-0000-0000-0000-000000000001',
  '72000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'Legacy post'
);

INSERT INTO "post_reactions" ("id", "post_id", "user_id", "reaction_type")
VALUES (
  '75000000-0000-0000-0000-000000000001',
  '74000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  'fire'
);

INSERT INTO "point_transactions" (
  "id", "user_id", "amount", "reason", "reference_type", "reference_id"
)
SELECT
  '76000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  10,
  'QUEST_COMPLETED',
  'DAILY_MISSION',
  "id"
FROM "daily_missions"
ORDER BY "title"
LIMIT 1;
