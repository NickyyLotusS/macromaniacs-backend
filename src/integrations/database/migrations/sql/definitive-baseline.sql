--
-- PostgreSQL database dump
--


-- Dumped from database version 15.19
-- Dumped by pg_dump version 15.19


--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--



--
-- Name: ActivityLevel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ActivityLevel" AS ENUM (
    'SEDENTARY',
    'LIGHT',
    'MODERATE',
    'INTENSE',
    'VERY_INTENSE'
);


--
-- Name: BiologicalSex; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."BiologicalSex" AS ENUM (
    'FEMALE',
    'MALE',
    'NOT_INFORMED'
);


--
-- Name: CosmeticType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."CosmeticType" AS ENUM (
    'TAG',
    'AVATAR',
    'FRAME',
    'BACKGROUND'
);


--
-- Name: DietPlanStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."DietPlanStatus" AS ENUM (
    'DRAFT',
    'ACTIVE',
    'COMPLETED',
    'ARCHIVED'
);


--
-- Name: FoodSource; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."FoodSource" AS ENUM (
    'TBCA',
    'OPEN_FOOD_FACTS',
    'USDA',
    'MANUAL'
);


--
-- Name: GroupChallengeStatus; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."GroupChallengeStatus" AS ENUM (
    'SCHEDULED',
    'ACTIVE',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: MealInputMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MealInputMethod" AS ENUM (
    'BARCODE',
    'PLANNED_MEAL',
    'PHOTO',
    'MANUAL'
);


--
-- Name: MemberRole; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."MemberRole" AS ENUM (
    'ADMIN',
    'MEMBER'
);


--
-- Name: PointTransactionReason; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."PointTransactionReason" AS ENUM (
    'DAILY_MISSION_COMPLETED',
    'ACHIEVEMENT_UNLOCKED',
    'MEAL_LOG_STREAK',
    'COSMETIC_PURCHASE',
    'ADMIN_ADJUSTMENT'
);


--
-- Name: ReactionType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ReactionType" AS ENUM (
    'LIKE',
    'FIRE',
    'CLAP'
);


--
-- Name: UserGoal; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."UserGoal" AS ENUM (
    'WEIGHT_LOSS',
    'MUSCLE_GAIN',
    'MAINTENANCE',
    'RECOMPOSITION',
    'STRENGTH_GAIN',
    'PERFORMANCE'
);




--
-- Name: achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.achievements (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(100) NOT NULL,
    description text,
    icon_url character varying(500),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT achievements_code_check CHECK (((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)),
    CONSTRAINT achievements_title_not_blank_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: body_measurements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.body_measurements (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    weight_kg numeric(5,2) NOT NULL,
    measured_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT body_measurements_weight_kg_check CHECK ((weight_kg > (0)::numeric))
);


--
-- Name: chat_messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.chat_messages (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT chat_messages_message_not_blank_check CHECK ((length(btrim(message)) > 0))
);


--
-- Name: cosmetic_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cosmetic_items (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    type public."CosmeticType" NOT NULL,
    price integer NOT NULL,
    asset_url character varying(500) NOT NULL,
    code character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT cosmetic_items_asset_url_check CHECK ((length(btrim((asset_url)::text)) > 0)),
    CONSTRAINT cosmetic_items_code_check CHECK (((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)),
    CONSTRAINT cosmetic_items_name_not_blank_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT cosmetic_items_price_check CHECK ((price >= 0))
);


--
-- Name: daily_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_missions (
    id uuid NOT NULL,
    title character varying(150) NOT NULL,
    target_count integer DEFAULT 1 NOT NULL,
    points_reward integer NOT NULL,
    code character varying(50) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT daily_missions_code_check CHECK (((code)::text ~ '^[A-Z0-9_]{2,50}$'::text)),
    CONSTRAINT daily_missions_points_reward_check CHECK ((points_reward >= 0)),
    CONSTRAINT daily_missions_target_count_check CHECK ((target_count > 0)),
    CONSTRAINT daily_missions_title_not_blank_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: diet_plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.diet_plans (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    title character varying(100) NOT NULL,
    status public."DietPlanStatus" DEFAULT 'ACTIVE'::public."DietPlanStatus" NOT NULL,
    target_calories integer NOT NULL,
    target_protein numeric(6,2) NOT NULL,
    target_carbs numeric(6,2) NOT NULL,
    target_fat numeric(6,2) NOT NULL,
    target_fiber numeric(6,2) DEFAULT 0 NOT NULL,
    start_date date,
    end_date date,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT diet_plans_date_range_check CHECK (((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date))),
    CONSTRAINT diet_plans_targets_check CHECK (((target_calories > 0) AND (target_protein >= (0)::numeric) AND (target_carbs >= (0)::numeric) AND (target_fat >= (0)::numeric) AND (target_fiber >= (0)::numeric))),
    CONSTRAINT diet_plans_title_not_blank_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: feed_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.feed_posts (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    meal_log_id uuid,
    content text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT feed_posts_content_check CHECK (((meal_log_id IS NOT NULL) OR ((content IS NOT NULL) AND (length(btrim(content)) > 0))))
);


--
-- Name: foods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.foods (
    id uuid NOT NULL,
    name character varying(255) NOT NULL,
    source public."FoodSource" NOT NULL,
    external_id character varying(100),
    barcode character varying(100),
    calories_per_100g numeric(6,2) NOT NULL,
    protein_per_100g numeric(6,2) NOT NULL,
    carbs_per_100g numeric(6,2) NOT NULL,
    fat_per_100g numeric(6,2) NOT NULL,
    fiber_per_100g numeric(6,2) DEFAULT 0 NOT NULL,
    serving_size_g numeric(6,2) DEFAULT 100 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT foods_barcode_check CHECK (((barcode IS NULL) OR (length(btrim((barcode)::text)) > 0))),
    CONSTRAINT foods_external_id_check CHECK (((external_id IS NULL) OR (length(btrim((external_id)::text)) > 0))),
    CONSTRAINT foods_name_not_blank_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT foods_nutrients_check CHECK (((calories_per_100g >= (0)::numeric) AND (protein_per_100g >= (0)::numeric) AND (carbs_per_100g >= (0)::numeric) AND (fat_per_100g >= (0)::numeric) AND (fiber_per_100g >= (0)::numeric))),
    CONSTRAINT foods_serving_size_g_check CHECK ((serving_size_g > (0)::numeric))
);


--
-- Name: group_challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_challenges (
    id uuid NOT NULL,
    group_id uuid NOT NULL,
    title character varying(150) NOT NULL,
    description text,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone NOT NULL,
    status public."GroupChallengeStatus" DEFAULT 'SCHEDULED'::public."GroupChallengeStatus" NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT group_challenges_date_range_check CHECK ((end_at > start_at)),
    CONSTRAINT group_challenges_title_not_blank_check CHECK ((length(btrim((title)::text)) > 0))
);


--
-- Name: group_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.group_members (
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public."MemberRole" DEFAULT 'MEMBER'::public."MemberRole" NOT NULL,
    joined_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.groups (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    invite_code character varying(8) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    creator_id uuid NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT groups_invite_code_check CHECK (((invite_code)::text ~ '^[A-Z0-9]{8}$'::text)),
    CONSTRAINT groups_name_not_blank_check CHECK ((length(btrim((name)::text)) > 0))
);


--
-- Name: meal_log_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_log_items (
    id uuid NOT NULL,
    meal_log_id uuid NOT NULL,
    food_id uuid,
    amount_grams numeric(6,2) NOT NULL,
    calories numeric(8,2) NOT NULL,
    protein numeric(6,2) NOT NULL,
    carbs numeric(6,2) NOT NULL,
    fat numeric(6,2) NOT NULL,
    fiber numeric(6,2) DEFAULT 0 NOT NULL,
    input_method public."MealInputMethod" NOT NULL,
    CONSTRAINT meal_log_items_amount_check CHECK ((amount_grams > (0)::numeric)),
    CONSTRAINT meal_log_items_nutrients_check CHECK (((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric)))
);


--
-- Name: meal_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.meal_logs (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    planned_meal_id uuid,
    name character varying(100) NOT NULL,
    photo_url character varying(500),
    consumed_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT meal_logs_name_not_blank_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT meal_logs_photo_url_check CHECK (((photo_url IS NULL) OR (length(btrim((photo_url)::text)) > 0)))
);


--
-- Name: planned_meal_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planned_meal_items (
    id uuid NOT NULL,
    planned_meal_id uuid NOT NULL,
    food_id uuid,
    amount_grams numeric(6,2) NOT NULL,
    calories numeric(8,2) NOT NULL,
    protein numeric(6,2) NOT NULL,
    carbs numeric(6,2) NOT NULL,
    fat numeric(6,2) NOT NULL,
    fiber numeric(6,2) DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT planned_meal_items_amount_check CHECK ((amount_grams > (0)::numeric)),
    CONSTRAINT planned_meal_items_nutrients_check CHECK (((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric)))
);


--
-- Name: planned_meals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.planned_meals (
    id uuid NOT NULL,
    diet_plan_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    order_index integer DEFAULT 1 NOT NULL,
    target_calories integer,
    target_protein numeric(6,2),
    target_carbs numeric(6,2),
    target_fat numeric(6,2),
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT planned_meals_name_not_blank_check CHECK ((length(btrim((name)::text)) > 0)),
    CONSTRAINT planned_meals_order_index_check CHECK ((order_index > 0)),
    CONSTRAINT planned_meals_targets_check CHECK ((((target_calories IS NULL) OR (target_calories >= 0)) AND ((target_protein IS NULL) OR (target_protein >= (0)::numeric)) AND ((target_carbs IS NULL) OR (target_carbs >= (0)::numeric)) AND ((target_fat IS NULL) OR (target_fat >= (0)::numeric))))
);


--
-- Name: point_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.point_transactions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    reason public."PointTransactionReason" NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT point_transactions_amount_check CHECK ((amount <> 0)),
    CONSTRAINT point_transactions_metadata_check CHECK ((jsonb_typeof(metadata) = 'object'::text))
);


--
-- Name: post_reactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.post_reactions (
    id uuid NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reaction_type public."ReactionType" NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_achievements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_achievements (
    user_id uuid NOT NULL,
    achievement_id uuid NOT NULL,
    unlocked_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_cosmetics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_cosmetics (
    user_id uuid NOT NULL,
    cosmetic_item_id uuid NOT NULL,
    acquired_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: user_daily_missions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_daily_missions (
    user_id uuid NOT NULL,
    mission_id uuid NOT NULL,
    current_progress integer DEFAULT 0 NOT NULL,
    is_claimed boolean DEFAULT false NOT NULL,
    date date NOT NULL,
    CONSTRAINT user_daily_missions_progress_check CHECK ((current_progress >= 0))
);


--
-- Name: user_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_profiles (
    user_id uuid NOT NULL,
    birth_date date NOT NULL,
    height_cm numeric(5,2) NOT NULL,
    current_weight_kg numeric(5,2) NOT NULL,
    goal public."UserGoal" NOT NULL,
    avatar_config jsonb DEFAULT '{}'::jsonb NOT NULL,
    biological_sex public."BiologicalSex" NOT NULL,
    activity_level public."ActivityLevel" NOT NULL,
    target_weight_kg numeric(5,2),
    target_date date,
    dietary_restrictions_note text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_profiles_avatar_config_check CHECK ((jsonb_typeof(avatar_config) = 'object'::text)),
    CONSTRAINT user_profiles_birth_date_check CHECK ((birth_date <= CURRENT_DATE)),
    CONSTRAINT user_profiles_current_weight_kg_check CHECK (((current_weight_kg IS NULL) OR (current_weight_kg > (0)::numeric))),
    CONSTRAINT user_profiles_dietary_note_check CHECK (((dietary_restrictions_note IS NULL) OR (length(btrim(dietary_restrictions_note)) > 0))),
    CONSTRAINT user_profiles_height_cm_check CHECK (((height_cm IS NULL) OR (height_cm > (0)::numeric))),
    CONSTRAINT user_profiles_target_date_check CHECK (((target_date IS NULL) OR (target_date > birth_date))),
    CONSTRAINT user_profiles_target_weight_kg_check CHECK (((target_weight_kg IS NULL) OR (target_weight_kg > (0)::numeric)))
);


--
-- Name: user_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_stats (
    user_id uuid NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    best_streak integer DEFAULT 0 NOT NULL,
    total_points integer DEFAULT 0 NOT NULL,
    last_activity_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT user_stats_streaks_check CHECK (((current_streak >= 0) AND (best_streak >= current_streak))),
    CONSTRAINT user_stats_total_points_check CHECK ((total_points >= 0))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    username character varying(50) NOT NULL,
    display_name character varying(100) NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT users_display_name_not_blank_check CHECK ((length(btrim((display_name)::text)) > 0)),
    CONSTRAINT users_email_format_check CHECK ((((email)::text = lower(btrim((email)::text))) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))),
    CONSTRAINT users_password_hash_not_blank_check CHECK ((length(btrim((password_hash)::text)) > 0)),
    CONSTRAINT users_username_format_check CHECK ((((username)::text = lower(btrim((username)::text))) AND ((username)::text ~ '^[a-z0-9_]{3,50}$'::text)))
);


--
-- Name: achievements achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.achievements
    ADD CONSTRAINT achievements_pkey PRIMARY KEY (id);


--
-- Name: body_measurements body_measurements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_pkey PRIMARY KEY (id);


--
-- Name: chat_messages chat_messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_pkey PRIMARY KEY (id);


--
-- Name: cosmetic_items cosmetic_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cosmetic_items
    ADD CONSTRAINT cosmetic_items_pkey PRIMARY KEY (id);


--
-- Name: daily_missions daily_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_missions
    ADD CONSTRAINT daily_missions_pkey PRIMARY KEY (id);


--
-- Name: diet_plans diet_plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_plans
    ADD CONSTRAINT diet_plans_pkey PRIMARY KEY (id);


--
-- Name: feed_posts feed_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_pkey PRIMARY KEY (id);


--
-- Name: foods foods_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.foods
    ADD CONSTRAINT foods_pkey PRIMARY KEY (id);


--
-- Name: group_challenges group_challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_pkey PRIMARY KEY (id);


--
-- Name: group_members group_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_pkey PRIMARY KEY (group_id, user_id);


--
-- Name: groups groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_pkey PRIMARY KEY (id);


--
-- Name: meal_log_items meal_log_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_log_items
    ADD CONSTRAINT meal_log_items_pkey PRIMARY KEY (id);


--
-- Name: meal_logs meal_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_pkey PRIMARY KEY (id);


--
-- Name: planned_meal_items planned_meal_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_items
    ADD CONSTRAINT planned_meal_items_pkey PRIMARY KEY (id);


--
-- Name: planned_meals planned_meals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_pkey PRIMARY KEY (id);


--
-- Name: point_transactions point_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_pkey PRIMARY KEY (id);


--
-- Name: post_reactions post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_pkey PRIMARY KEY (id);


--
-- Name: user_achievements user_achievements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_id);


--
-- Name: user_cosmetics user_cosmetics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cosmetics
    ADD CONSTRAINT user_cosmetics_pkey PRIMARY KEY (user_id, cosmetic_item_id);


--
-- Name: user_daily_missions user_daily_missions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_missions
    ADD CONSTRAINT user_daily_missions_pkey PRIMARY KEY (user_id, mission_id, date);


--
-- Name: user_profiles user_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id);


--
-- Name: user_stats user_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: achievements_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX achievements_code_key ON public.achievements USING btree (code);


--
-- Name: body_measurements_user_id_measured_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX body_measurements_user_id_measured_at_idx ON public.body_measurements USING btree (user_id, measured_at DESC);


--
-- Name: chat_messages_group_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_group_id_created_at_idx ON public.chat_messages USING btree (group_id, created_at DESC);


--
-- Name: chat_messages_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX chat_messages_user_id_idx ON public.chat_messages USING btree (user_id);


--
-- Name: cosmetic_items_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cosmetic_items_code_key ON public.cosmetic_items USING btree (code);


--
-- Name: daily_missions_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX daily_missions_code_key ON public.daily_missions USING btree (code);


--
-- Name: diet_plans_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX diet_plans_user_id_status_idx ON public.diet_plans USING btree (user_id, status);


--
-- Name: feed_posts_group_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_group_id_created_at_idx ON public.feed_posts USING btree (group_id, created_at DESC);


--
-- Name: feed_posts_meal_log_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_meal_log_id_idx ON public.feed_posts USING btree (meal_log_id);


--
-- Name: feed_posts_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX feed_posts_user_id_created_at_idx ON public.feed_posts USING btree (user_id, created_at DESC);


--
-- Name: foods_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX foods_barcode_key ON public.foods USING btree (barcode);


--
-- Name: foods_name_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX foods_name_idx ON public.foods USING btree (name);


--
-- Name: foods_source_external_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX foods_source_external_id_key ON public.foods USING btree (source, external_id);


--
-- Name: group_challenges_group_id_status_start_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_challenges_group_id_status_start_at_idx ON public.group_challenges USING btree (group_id, status, start_at);


--
-- Name: group_members_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX group_members_user_id_idx ON public.group_members USING btree (user_id);


--
-- Name: groups_creator_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX groups_creator_id_idx ON public.groups USING btree (creator_id);


--
-- Name: groups_invite_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX groups_invite_code_key ON public.groups USING btree (invite_code);


--
-- Name: meal_log_items_food_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_log_items_food_id_idx ON public.meal_log_items USING btree (food_id);


--
-- Name: meal_log_items_meal_log_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_log_items_meal_log_id_idx ON public.meal_log_items USING btree (meal_log_id);


--
-- Name: meal_logs_planned_meal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_logs_planned_meal_id_idx ON public.meal_logs USING btree (planned_meal_id);


--
-- Name: meal_logs_user_id_consumed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX meal_logs_user_id_consumed_at_idx ON public.meal_logs USING btree (user_id, consumed_at);


--
-- Name: planned_meal_items_food_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meal_items_food_id_idx ON public.planned_meal_items USING btree (food_id);


--
-- Name: planned_meal_items_planned_meal_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX planned_meal_items_planned_meal_id_idx ON public.planned_meal_items USING btree (planned_meal_id);


--
-- Name: planned_meals_diet_plan_id_order_index_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX planned_meals_diet_plan_id_order_index_key ON public.planned_meals USING btree (diet_plan_id, order_index);


--
-- Name: point_transactions_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX point_transactions_user_id_created_at_idx ON public.point_transactions USING btree (user_id, created_at DESC);


--
-- Name: post_reactions_post_id_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX post_reactions_post_id_user_id_key ON public.post_reactions USING btree (post_id, user_id);


--
-- Name: post_reactions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX post_reactions_user_id_idx ON public.post_reactions USING btree (user_id);


--
-- Name: user_achievements_achievement_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_achievements_achievement_id_idx ON public.user_achievements USING btree (achievement_id);


--
-- Name: user_cosmetics_cosmetic_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_cosmetics_cosmetic_item_id_idx ON public.user_cosmetics USING btree (cosmetic_item_id);


--
-- Name: user_daily_missions_mission_id_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_daily_missions_mission_id_date_idx ON public.user_daily_missions USING btree (mission_id, date);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: users_username_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_username_key ON public.users USING btree (username);


--
-- Name: body_measurements body_measurements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.body_measurements
    ADD CONSTRAINT body_measurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: chat_messages chat_messages_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.chat_messages
    ADD CONSTRAINT chat_messages_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: diet_plans diet_plans_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.diet_plans
    ADD CONSTRAINT diet_plans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_posts feed_posts_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: feed_posts feed_posts_meal_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_meal_log_id_fkey FOREIGN KEY (meal_log_id) REFERENCES public.meal_logs(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: feed_posts feed_posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.feed_posts
    ADD CONSTRAINT feed_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_challenges group_challenges_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_challenges
    ADD CONSTRAINT group_challenges_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_members group_members_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.groups(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: group_members group_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.group_members
    ADD CONSTRAINT group_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: groups groups_creator_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.groups
    ADD CONSTRAINT groups_creator_id_fkey FOREIGN KEY (creator_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: meal_log_items meal_log_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_log_items
    ADD CONSTRAINT meal_log_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: meal_log_items meal_log_items_meal_log_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_log_items
    ADD CONSTRAINT meal_log_items_meal_log_id_fkey FOREIGN KEY (meal_log_id) REFERENCES public.meal_logs(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: meal_logs meal_logs_planned_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_planned_meal_id_fkey FOREIGN KEY (planned_meal_id) REFERENCES public.planned_meals(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: meal_logs meal_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.meal_logs
    ADD CONSTRAINT meal_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: planned_meal_items planned_meal_items_food_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_items
    ADD CONSTRAINT planned_meal_items_food_id_fkey FOREIGN KEY (food_id) REFERENCES public.foods(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: planned_meal_items planned_meal_items_planned_meal_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meal_items
    ADD CONSTRAINT planned_meal_items_planned_meal_id_fkey FOREIGN KEY (planned_meal_id) REFERENCES public.planned_meals(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: planned_meals planned_meals_diet_plan_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.planned_meals
    ADD CONSTRAINT planned_meals_diet_plan_id_fkey FOREIGN KEY (diet_plan_id) REFERENCES public.diet_plans(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: point_transactions point_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.point_transactions
    ADD CONSTRAINT point_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_reactions post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.feed_posts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: post_reactions post_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_achievements user_achievements_achievement_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_achievement_id_fkey FOREIGN KEY (achievement_id) REFERENCES public.achievements(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_achievements user_achievements_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_achievements
    ADD CONSTRAINT user_achievements_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_cosmetics user_cosmetics_cosmetic_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cosmetics
    ADD CONSTRAINT user_cosmetics_cosmetic_item_id_fkey FOREIGN KEY (cosmetic_item_id) REFERENCES public.cosmetic_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_cosmetics user_cosmetics_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_cosmetics
    ADD CONSTRAINT user_cosmetics_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_daily_missions user_daily_missions_mission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_missions
    ADD CONSTRAINT user_daily_missions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES public.daily_missions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_daily_missions user_daily_missions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_daily_missions
    ADD CONSTRAINT user_daily_missions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_profiles user_profiles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_profiles
    ADD CONSTRAINT user_profiles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_stats user_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_stats
    ADD CONSTRAINT user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
