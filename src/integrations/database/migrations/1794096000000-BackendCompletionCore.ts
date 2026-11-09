import type { MigrationInterface, QueryRunner } from 'typeorm';

export const COMPLETION_NAME = 'BackendCompletionCore1794096000000';

export class BackendCompletionCore1794096000000 implements MigrationInterface {
  name = COMPLETION_NAME;

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE public.user_terms_acceptances (
        id uuid NOT NULL,
        user_id uuid NOT NULL,
        terms_version varchar(64) NOT NULL,
        accepted_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT user_terms_acceptances_pkey PRIMARY KEY (id),
        CONSTRAINT user_terms_acceptances_version_not_blank_check
          CHECK (length(btrim(terms_version)) > 0),
        CONSTRAINT user_terms_acceptances_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES public.users(id)
          ON UPDATE CASCADE ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX user_terms_acceptances_user_id_terms_version_key
        ON public.user_terms_acceptances USING btree (user_id, terms_version);

      ALTER TABLE public.user_profiles
        ALTER COLUMN birth_date DROP NOT NULL,
        ALTER COLUMN biological_sex DROP NOT NULL,
        ALTER COLUMN height_cm DROP NOT NULL,
        ALTER COLUMN current_weight_kg DROP NOT NULL,
        ALTER COLUMN goal DROP NOT NULL,
        ALTER COLUMN activity_level DROP NOT NULL,
        ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'UTC',
        ADD COLUMN onboarding_completed_at timestamptz;
      UPDATE public.user_profiles
        SET onboarding_completed_at = created_at
        WHERE birth_date IS NOT NULL
          AND biological_sex IS NOT NULL
          AND height_cm IS NOT NULL
          AND current_weight_kg IS NOT NULL
          AND goal IS NOT NULL
          AND activity_level IS NOT NULL;
      ALTER TABLE public.user_profiles
        ADD CONSTRAINT user_profiles_timezone_not_blank_check
        CHECK (length(btrim(timezone)) > 0);

      ALTER TABLE public.planned_meals
        ADD COLUMN scheduled_time time without time zone;
      ALTER TABLE public.foods
        ADD COLUMN retrieved_at timestamptz;

      ALTER TABLE public.meal_logs
        ADD COLUMN food_date date,
        ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'UTC',
        ADD COLUMN idempotency_key varchar(128),
        ADD COLUMN deleted_at timestamptz;
      UPDATE public.meal_logs
        SET food_date = (consumed_at AT TIME ZONE 'UTC')::date;
      ALTER TABLE public.meal_logs
        ALTER COLUMN food_date SET NOT NULL,
        ADD CONSTRAINT meal_logs_timezone_not_blank_check
          CHECK (length(btrim(timezone)) > 0),
        ADD CONSTRAINT meal_logs_idempotency_key_not_blank_check
          CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0);
      CREATE UNIQUE INDEX meal_logs_user_id_idempotency_key_key
        ON public.meal_logs USING btree (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE INDEX meal_logs_user_id_food_date_idx
        ON public.meal_logs USING btree (user_id, food_date);

      CREATE TABLE public.daily_nutrition_snapshots (
        user_id uuid NOT NULL,
        food_date date NOT NULL,
        timezone varchar(64) NOT NULL,
        calories numeric(10,2) NOT NULL DEFAULT 0,
        protein numeric(10,2) NOT NULL DEFAULT 0,
        carbs numeric(10,2) NOT NULL DEFAULT 0,
        fat numeric(10,2) NOT NULL DEFAULT 0,
        fiber numeric(10,2) NOT NULL DEFAULT 0,
        meal_count integer NOT NULL DEFAULT 0,
        target_calories integer,
        created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT daily_nutrition_snapshots_pkey PRIMARY KEY (user_id, food_date),
        CONSTRAINT daily_nutrition_snapshots_user_id_fkey
          FOREIGN KEY (user_id) REFERENCES public.users(id)
          ON UPDATE CASCADE ON DELETE CASCADE,
        CONSTRAINT daily_nutrition_snapshots_totals_check CHECK (
          calories >= 0 AND protein >= 0 AND carbs >= 0 AND fat >= 0
          AND fiber >= 0 AND meal_count >= 0
        ),
        CONSTRAINT daily_nutrition_snapshots_timezone_not_blank_check
          CHECK (length(btrim(timezone)) > 0)
      );
      CREATE INDEX daily_nutrition_snapshots_user_id_food_date_idx
        ON public.daily_nutrition_snapshots USING btree (user_id, food_date);

      ALTER TABLE public.user_stats
        ADD COLUMN last_activity_date date,
        ADD COLUMN timezone varchar(64) NOT NULL DEFAULT 'UTC';
      ALTER TABLE public.user_stats
        ADD CONSTRAINT user_stats_timezone_not_blank_check
        CHECK (length(btrim(timezone)) > 0);

      ALTER TABLE public.point_transactions
        ADD COLUMN idempotency_key varchar(128),
        ADD COLUMN source_type varchar(64),
        ADD COLUMN source_id uuid;
      ALTER TABLE public.point_transactions
        ADD CONSTRAINT point_transactions_idempotency_key_not_blank_check
        CHECK (idempotency_key IS NULL OR length(btrim(idempotency_key)) > 0);
      CREATE UNIQUE INDEX point_transactions_user_id_idempotency_key_key
        ON public.point_transactions USING btree (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;

      ALTER TABLE public.user_cosmetics
        ADD COLUMN is_equipped boolean NOT NULL DEFAULT false;
      ALTER TABLE public.cosmetic_items
        ADD COLUMN is_active boolean NOT NULL DEFAULT true;
      ALTER TABLE public.groups
        ADD COLUMN is_private boolean NOT NULL DEFAULT true;
      CREATE UNIQUE INDEX feed_posts_group_id_meal_log_id_key
        ON public.feed_posts USING btree (group_id, meal_log_id)
        WHERE meal_log_id IS NOT NULL;

      CREATE TABLE public.outbox_events (
        id uuid NOT NULL,
        aggregate_type varchar(64) NOT NULL,
        aggregate_id uuid NOT NULL,
        event_type varchar(100) NOT NULL,
        deduplication_key varchar(180) NOT NULL,
        payload jsonb NOT NULL DEFAULT '{}'::jsonb,
        occurred_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        processed_at timestamptz,
        attempts integer NOT NULL DEFAULT 0,
        last_error text,
        CONSTRAINT outbox_events_pkey PRIMARY KEY (id),
        CONSTRAINT outbox_events_payload_check
          CHECK (jsonb_typeof(payload) = 'object'),
        CONSTRAINT outbox_events_attempts_check CHECK (attempts >= 0)
      );
      CREATE UNIQUE INDEX outbox_events_deduplication_key_key
        ON public.outbox_events USING btree (deduplication_key);
      CREATE INDEX outbox_events_unprocessed_idx
        ON public.outbox_events USING btree (occurred_at)
        WHERE processed_at IS NULL;

      CREATE FUNCTION public.reject_point_transaction_mutation()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
          RETURN OLD;
        END IF;
        RAISE EXCEPTION 'point_transactions is an immutable ledger';
      END;
      CREATE TRIGGER point_transactions_immutable_trigger
        BEFORE UPDATE OR DELETE ON public.point_transactions
        FOR EACH ROW EXECUTE FUNCTION public.reject_point_transaction_mutation();
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ count }] = (await queryRunner.query(`
      SELECT count(*)::int AS count FROM public.user_profiles
      WHERE birth_date IS NULL OR biological_sex IS NULL OR height_cm IS NULL
        OR current_weight_kg IS NULL OR goal IS NULL OR activity_level IS NULL
    `)) as Array<{ count: number }>;
    if (Number(count) > 0) {
      throw new Error(
        'Cannot revert completion migration while incomplete profiles exist.',
      );
    }

    await queryRunner.query(`
      DROP TRIGGER point_transactions_immutable_trigger ON public.point_transactions;
      DROP FUNCTION public.reject_point_transaction_mutation();
      DROP TABLE public.outbox_events;
      DROP INDEX public.feed_posts_group_id_meal_log_id_key;
      ALTER TABLE public.groups DROP COLUMN is_private;
      ALTER TABLE public.cosmetic_items DROP COLUMN is_active;
      ALTER TABLE public.user_cosmetics DROP COLUMN is_equipped;
      DROP INDEX public.point_transactions_user_id_idempotency_key_key;
      ALTER TABLE public.point_transactions
        DROP CONSTRAINT point_transactions_idempotency_key_not_blank_check,
        DROP COLUMN source_id,
        DROP COLUMN source_type,
        DROP COLUMN idempotency_key;
      ALTER TABLE public.user_stats
        DROP CONSTRAINT user_stats_timezone_not_blank_check,
        DROP COLUMN timezone,
        DROP COLUMN last_activity_date;
      DROP TABLE public.daily_nutrition_snapshots;
      DROP INDEX public.meal_logs_user_id_food_date_idx;
      DROP INDEX public.meal_logs_user_id_idempotency_key_key;
      ALTER TABLE public.meal_logs
        DROP CONSTRAINT meal_logs_idempotency_key_not_blank_check,
        DROP CONSTRAINT meal_logs_timezone_not_blank_check,
        DROP COLUMN deleted_at,
        DROP COLUMN idempotency_key,
        DROP COLUMN timezone,
        DROP COLUMN food_date;
      ALTER TABLE public.foods DROP COLUMN retrieved_at;
      ALTER TABLE public.planned_meals DROP COLUMN scheduled_time;
      ALTER TABLE public.user_profiles
        DROP CONSTRAINT user_profiles_timezone_not_blank_check,
        DROP COLUMN onboarding_completed_at,
        DROP COLUMN timezone,
        ALTER COLUMN activity_level SET NOT NULL,
        ALTER COLUMN goal SET NOT NULL,
        ALTER COLUMN current_weight_kg SET NOT NULL,
        ALTER COLUMN height_cm SET NOT NULL,
        ALTER COLUMN biological_sex SET NOT NULL,
        ALTER COLUMN birth_date SET NOT NULL;
      DROP TABLE public.user_terms_acceptances;
    `);
  }
}
