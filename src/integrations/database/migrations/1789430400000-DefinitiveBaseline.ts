import { readFileSync } from 'node:fs';
import { databaseResourcePath } from '../resource-path';
import type { MigrationInterface, QueryRunner } from 'typeorm';

export const BASELINE_NAME = 'DefinitiveBaseline1789430400000';

/** Final PostgreSQL architecture, not a replay of the Prisma history. */
export class DefinitiveBaseline1789430400000 implements MigrationInterface {
  name = BASELINE_NAME;

  async up(queryRunner: QueryRunner): Promise<void> {
    const existing = await queryRunner.query(
      `SELECT tablename FROM pg_tables WHERE schemaname = 'public'
       AND tablename NOT IN ('migrations')`,
    );
    if (existing.length !== 0) {
      throw new Error(
        'Baseline exige banco vazio. Para banco Prisma existente, valide a paridade e registre somente a baseline com --fake.',
      );
    }
    await queryRunner.query(
      readFileSync(
        databaseResourcePath('migrations/sql/definitive-baseline.sql'),
        'utf8',
      ),
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [{ database }] = await queryRunner.query(
      'SELECT current_database() AS database',
    );
    if (
      process.env.ALLOW_DESTRUCTIVE_BASELINE_REVERT !== 'true' ||
      !/^macromaniacs_test_[a-z0-9_]+$/.test(database)
    ) {
      throw new Error(
        'Revert da baseline é destrutivo e permitido somente em banco descartável explicitamente autorizado.',
      );
    }
    await queryRunner.query(`DROP TABLE public.user_cosmetics, public.user_daily_missions,
      public.user_achievements, public.point_transactions, public.chat_messages,
      public.post_reactions, public.feed_posts, public.group_challenges,
      public.group_members, public.groups, public.meal_log_items, public.meal_logs,
      public.planned_meal_items, public.planned_meals, public.diet_plans,
      public.foods, public.user_stats, public.body_measurements, public.user_profiles,
      public.users, public.achievements, public.daily_missions, public.cosmetic_items`);
    await queryRunner.query(`DROP TYPE public."UserGoal", public."BiologicalSex",
      public."ActivityLevel", public."FoodSource", public."MealInputMethod",
      public."CosmeticType", public."MemberRole", public."DietPlanStatus",
      public."GroupChallengeStatus", public."ReactionType", public."PointTransactionReason"`);
  }
}
