import type { SchemaSnapshot } from './schema-inspection';

type Row = Record<string, unknown>;

const table = (name: string): Row => ({
  name,
  kind: 'r',
  persistence: 'p',
  row_security: false,
  force_row_security: false,
});

function column(
  tableName: string,
  name: string,
  position: number,
  type: string,
  notNull: boolean,
  defaultExpression: string | null = null,
): Row {
  return {
    table_name: tableName,
    name,
    position,
    type,
    not_null: notNull,
    default_expression: defaultExpression,
    identity: '',
    generated: '',
    collation:
      type === 'text' || type.startsWith('character varying')
        ? 'default'
        : null,
  };
}

const constraint = (
  tableName: string,
  name: string,
  type: string,
  definition: string,
  noInherit: boolean,
): Row => ({
  table_name: tableName,
  name,
  type,
  definition,
  validated: true,
  deferrable: false,
  deferred: false,
  no_inherit: noInherit,
});

const index = (
  tableName: string,
  name: string,
  definition: string,
  unique = false,
  primary = false,
): Row => ({
  table_name: tableName,
  name,
  definition,
  is_unique: unique || primary,
  is_primary: primary,
  valid: true,
  ready: true,
});

export function completionSchemaContract(base: SchemaSnapshot): SchemaSnapshot {
  const schema = structuredClone(base);
  schema.tables.push(
    table('daily_nutrition_snapshots'),
    table('outbox_events'),
    table('user_terms_acceptances'),
  );

  for (const name of [
    'birth_date',
    'biological_sex',
    'height_cm',
    'current_weight_kg',
    'goal',
    'activity_level',
  ]) {
    const existing = schema.columns.find(
      (entry) => entry.table_name === 'user_profiles' && entry.name === name,
    );
    if (existing) existing.not_null = false;
  }
  const append = (
    tableName: string,
    name: string,
    type: string,
    notNull: boolean,
    defaultExpression: string | null = null,
  ) => {
    const position =
      Math.max(
        0,
        ...schema.columns
          .filter((entry) => entry.table_name === tableName)
          .map((entry) => Number(entry.position)),
      ) + 1;
    schema.columns.push(
      column(tableName, name, position, type, notNull, defaultExpression),
    );
  };
  append(
    'user_profiles',
    'timezone',
    'character varying(64)',
    true,
    "'UTC'::character varying",
  );
  append(
    'user_profiles',
    'onboarding_completed_at',
    'timestamp with time zone',
    false,
  );
  append('planned_meals', 'scheduled_time', 'time without time zone', false);
  append('foods', 'retrieved_at', 'timestamp with time zone', false);
  append('meal_logs', 'food_date', 'date', true);
  append(
    'meal_logs',
    'timezone',
    'character varying(64)',
    true,
    "'UTC'::character varying",
  );
  append('meal_logs', 'idempotency_key', 'character varying(128)', false);
  append('meal_logs', 'deleted_at', 'timestamp with time zone', false);
  append('user_stats', 'last_activity_date', 'date', false);
  append(
    'user_stats',
    'timezone',
    'character varying(64)',
    true,
    "'UTC'::character varying",
  );
  append(
    'point_transactions',
    'idempotency_key',
    'character varying(128)',
    false,
  );
  append('point_transactions', 'source_type', 'character varying(64)', false);
  append('point_transactions', 'source_id', 'uuid', false);
  append('user_cosmetics', 'is_equipped', 'boolean', true, 'false');
  append('cosmetic_items', 'is_active', 'boolean', true, 'true');
  append('groups', 'is_private', 'boolean', true, 'true');

  schema.columns.push(
    column('daily_nutrition_snapshots', 'user_id', 1, 'uuid', true),
    column('daily_nutrition_snapshots', 'food_date', 2, 'date', true),
    column(
      'daily_nutrition_snapshots',
      'timezone',
      3,
      'character varying(64)',
      true,
    ),
    column(
      'daily_nutrition_snapshots',
      'calories',
      4,
      'numeric(10,2)',
      true,
      '0',
    ),
    column(
      'daily_nutrition_snapshots',
      'protein',
      5,
      'numeric(10,2)',
      true,
      '0',
    ),
    column('daily_nutrition_snapshots', 'carbs', 6, 'numeric(10,2)', true, '0'),
    column('daily_nutrition_snapshots', 'fat', 7, 'numeric(10,2)', true, '0'),
    column('daily_nutrition_snapshots', 'fiber', 8, 'numeric(10,2)', true, '0'),
    column('daily_nutrition_snapshots', 'meal_count', 9, 'integer', true, '0'),
    column(
      'daily_nutrition_snapshots',
      'target_calories',
      10,
      'integer',
      false,
    ),
    column(
      'daily_nutrition_snapshots',
      'created_at',
      11,
      'timestamp with time zone',
      true,
      'CURRENT_TIMESTAMP',
    ),
    column(
      'daily_nutrition_snapshots',
      'updated_at',
      12,
      'timestamp with time zone',
      true,
      'CURRENT_TIMESTAMP',
    ),
    column('outbox_events', 'id', 1, 'uuid', true),
    column('outbox_events', 'aggregate_type', 2, 'character varying(64)', true),
    column('outbox_events', 'aggregate_id', 3, 'uuid', true),
    column('outbox_events', 'event_type', 4, 'character varying(100)', true),
    column(
      'outbox_events',
      'deduplication_key',
      5,
      'character varying(180)',
      true,
    ),
    column('outbox_events', 'payload', 6, 'jsonb', true, "'{}'::jsonb"),
    column(
      'outbox_events',
      'occurred_at',
      7,
      'timestamp with time zone',
      true,
      'CURRENT_TIMESTAMP',
    ),
    column(
      'outbox_events',
      'processed_at',
      8,
      'timestamp with time zone',
      false,
    ),
    column('outbox_events', 'attempts', 9, 'integer', true, '0'),
    column('outbox_events', 'last_error', 10, 'text', false),
    column('user_terms_acceptances', 'id', 1, 'uuid', true),
    column('user_terms_acceptances', 'user_id', 2, 'uuid', true),
    column(
      'user_terms_acceptances',
      'terms_version',
      3,
      'character varying(64)',
      true,
    ),
    column(
      'user_terms_acceptances',
      'accepted_at',
      4,
      'timestamp with time zone',
      true,
      'CURRENT_TIMESTAMP',
    ),
  );

  schema.constraints.push(
    constraint(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_pkey',
      'p',
      'PRIMARY KEY (user_id, food_date)',
      true,
    ),
    constraint(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_totals_check',
      'c',
      'CHECK (((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric) AND (meal_count >= 0)))',
      false,
    ),
    constraint(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_timezone_not_blank_check',
      'c',
      'CHECK ((length(btrim((timezone)::text)) > 0))',
      false,
    ),
    constraint(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_user_id_fkey',
      'f',
      'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE',
      true,
    ),
    constraint(
      'meal_logs',
      'meal_logs_idempotency_key_not_blank_check',
      'c',
      'CHECK (((idempotency_key IS NULL) OR (length(btrim((idempotency_key)::text)) > 0)))',
      false,
    ),
    constraint(
      'meal_logs',
      'meal_logs_timezone_not_blank_check',
      'c',
      'CHECK ((length(btrim((timezone)::text)) > 0))',
      false,
    ),
    constraint(
      'outbox_events',
      'outbox_events_attempts_check',
      'c',
      'CHECK ((attempts >= 0))',
      false,
    ),
    constraint(
      'outbox_events',
      'outbox_events_payload_check',
      'c',
      "CHECK ((jsonb_typeof(payload) = 'object'::text))",
      false,
    ),
    constraint(
      'outbox_events',
      'outbox_events_pkey',
      'p',
      'PRIMARY KEY (id)',
      true,
    ),
    constraint(
      'point_transactions',
      'point_transactions_idempotency_key_not_blank_check',
      'c',
      'CHECK (((idempotency_key IS NULL) OR (length(btrim((idempotency_key)::text)) > 0)))',
      false,
    ),
    constraint(
      'user_profiles',
      'user_profiles_timezone_not_blank_check',
      'c',
      'CHECK ((length(btrim((timezone)::text)) > 0))',
      false,
    ),
    constraint(
      'user_stats',
      'user_stats_timezone_not_blank_check',
      'c',
      'CHECK ((length(btrim((timezone)::text)) > 0))',
      false,
    ),
    constraint(
      'user_terms_acceptances',
      'user_terms_acceptances_pkey',
      'p',
      'PRIMARY KEY (id)',
      true,
    ),
    constraint(
      'user_terms_acceptances',
      'user_terms_acceptances_user_id_fkey',
      'f',
      'FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE',
      true,
    ),
    constraint(
      'user_terms_acceptances',
      'user_terms_acceptances_version_not_blank_check',
      'c',
      'CHECK ((length(btrim((terms_version)::text)) > 0))',
      false,
    ),
  );

  schema.indices.push(
    index(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_pkey',
      'CREATE UNIQUE INDEX daily_nutrition_snapshots_pkey ON public.daily_nutrition_snapshots USING btree (user_id, food_date)',
      true,
      true,
    ),
    index(
      'daily_nutrition_snapshots',
      'daily_nutrition_snapshots_user_id_food_date_idx',
      'CREATE INDEX daily_nutrition_snapshots_user_id_food_date_idx ON public.daily_nutrition_snapshots USING btree (user_id, food_date)',
    ),
    index(
      'feed_posts',
      'feed_posts_group_id_meal_log_id_key',
      'CREATE UNIQUE INDEX feed_posts_group_id_meal_log_id_key ON public.feed_posts USING btree (group_id, meal_log_id) WHERE (meal_log_id IS NOT NULL)',
      true,
    ),
    index(
      'meal_logs',
      'meal_logs_user_id_food_date_idx',
      'CREATE INDEX meal_logs_user_id_food_date_idx ON public.meal_logs USING btree (user_id, food_date)',
    ),
    index(
      'meal_logs',
      'meal_logs_user_id_idempotency_key_key',
      'CREATE UNIQUE INDEX meal_logs_user_id_idempotency_key_key ON public.meal_logs USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL)',
      true,
    ),
    index(
      'outbox_events',
      'outbox_events_deduplication_key_key',
      'CREATE UNIQUE INDEX outbox_events_deduplication_key_key ON public.outbox_events USING btree (deduplication_key)',
      true,
    ),
    index(
      'outbox_events',
      'outbox_events_pkey',
      'CREATE UNIQUE INDEX outbox_events_pkey ON public.outbox_events USING btree (id)',
      true,
      true,
    ),
    index(
      'outbox_events',
      'outbox_events_unprocessed_idx',
      'CREATE INDEX outbox_events_unprocessed_idx ON public.outbox_events USING btree (occurred_at) WHERE (processed_at IS NULL)',
    ),
    index(
      'point_transactions',
      'point_transactions_user_id_idempotency_key_key',
      'CREATE UNIQUE INDEX point_transactions_user_id_idempotency_key_key ON public.point_transactions USING btree (user_id, idempotency_key) WHERE (idempotency_key IS NOT NULL)',
      true,
    ),
    index(
      'user_terms_acceptances',
      'user_terms_acceptances_pkey',
      'CREATE UNIQUE INDEX user_terms_acceptances_pkey ON public.user_terms_acceptances USING btree (id)',
      true,
      true,
    ),
    index(
      'user_terms_acceptances',
      'user_terms_acceptances_user_id_terms_version_key',
      'CREATE UNIQUE INDEX user_terms_acceptances_user_id_terms_version_key ON public.user_terms_acceptances USING btree (user_id, terms_version)',
      true,
    ),
  );
  schema.routines.push({
    name: 'reject_point_transaction_mutation',
    arguments: '',
    definition: '',
  });
  schema.triggers.push({
    table_name: 'point_transactions',
    name: 'point_transactions_immutable_trigger',
    definition: '',
    enabled: 'O',
  });
  schema.tables.sort((left, right) =>
    String(left.name).localeCompare(String(right.name)),
  );
  schema.columns.sort(
    (left, right) =>
      String(left.table_name).localeCompare(String(right.table_name)) ||
      Number(left.position) - Number(right.position),
  );
  for (const key of ['constraints', 'indices'] as const) {
    schema[key].sort((left, right) =>
      `${left.table_name}:${left.name}`.localeCompare(
        `${right.table_name}:${right.name}`,
      ),
    );
  }
  return schema;
}
