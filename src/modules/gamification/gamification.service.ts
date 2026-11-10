import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';
import { Achievement } from '../../integrations/database/entities/catalogs/achievement.entity';
import { DailyMission } from '../../integrations/database/entities/catalogs/daily-mission.entity';
import {
  DietPlanStatus,
  PointTransactionReason,
} from '../../integrations/database/entities/enums';
import { OutboxEvent } from '../../integrations/database/entities/events/outbox-event.entity';
import { PointTransaction } from '../../integrations/database/entities/gamification/point-transaction.entity';
import { UserAchievement } from '../../integrations/database/entities/gamification/user-achievement.entity';
import { UserDailyMission } from '../../integrations/database/entities/gamification/user-daily-mission.entity';
import { UserStats } from '../../integrations/database/entities/gamification/user-stats.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { DailyNutritionSnapshot } from '../../integrations/database/entities/nutrition/daily-nutrition-snapshot.entity';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import {
  paginationMeta,
  type PaginationQueryDto,
} from '../../shared/http/pagination.dto';
import { foodDateAt } from '../../shared/time/timezone';
import { FeedPost } from '../../integrations/database/entities/social/feed-post.entity';
import { GroupMember } from '../../integrations/database/entities/social/group-member.entity';
import type {
  AchievementProgressDto,
  DailyMissionProgressDto,
  GamificationSummaryDto,
  PointLedgerResponseDto,
} from './dto/gamification-response.dto';
import { SCORING_RULES_V1 } from './scoring-rules';

type LedgerInput = Omit<
  Pick<
    PointTransaction,
    | 'userId'
    | 'amount'
    | 'reason'
    | 'idempotencyKey'
    | 'sourceType'
    | 'sourceId'
    | 'metadata'
  >,
  'idempotencyKey'
> & { idempotencyKey: string };

@Injectable()
export class GamificationService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(UserStats)
    private readonly stats: Repository<UserStats>,
    @InjectRepository(PointTransaction)
    private readonly transactions: Repository<PointTransaction>,
    @InjectRepository(OutboxEvent)
    private readonly outbox: Repository<OutboxEvent>,
    @InjectRepository(UserProfile)
    private readonly profiles: Repository<UserProfile>,
  ) {}

  async summary(userId: string): Promise<GamificationSummaryDto> {
    await this.processPendingForUser(userId);
    const current = await this.stats.findOneByOrFail({ userId });
    await this.dataSource.transaction((manager) =>
      this.recomputeStats(manager, current),
    );
    const refreshed = await this.stats.findOneByOrFail({ userId });
    return {
      currentStreak: refreshed.currentStreak,
      bestStreak: refreshed.bestStreak,
      totalPoints: refreshed.totalPoints,
      lastActivityDate: refreshed.lastActivityAt
        ? foodDateAt(refreshed.lastActivityAt, refreshed.timezone)
        : null,
      timezone: refreshed.timezone,
      scoringVersion: SCORING_RULES_V1.version,
    };
  }

  async ledger(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<PointLedgerResponseDto> {
    await this.processPendingForUser(userId);
    const [items, total] = await this.transactions.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: items.map((entry) => ({
        id: entry.id,
        amount: entry.amount,
        reason: entry.reason,
        metadata: entry.metadata,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        createdAt: entry.createdAt.toISOString(),
      })),
      meta: paginationMeta(total, query),
    };
  }

  async achievements(userId: string): Promise<AchievementProgressDto[]> {
    await this.processPendingForUser(userId);
    const rows = await this.dataSource.getRepository(UserAchievement).find({
      where: { userId },
      relations: { achievement: true },
      order: { unlockedAt: 'ASC' },
    });
    return rows.map((row) => ({
      id: row.achievement.id,
      code: row.achievement.code,
      title: row.achievement.title,
      description: row.achievement.description,
      unlockedAt: row.unlockedAt.toISOString(),
    }));
  }

  async missions(
    userId: string,
    requestedDate?: string,
  ): Promise<DailyMissionProgressDto[]> {
    await this.processPendingForUser(userId);
    const profile = await this.profiles.findOneByOrFail({ userId });
    const date = requestedDate ?? foodDateAt(new Date(), profile.timezone);
    await this.dataSource.transaction(async (manager) => {
      await this.evaluateMissions(manager, userId, date);
      const stats = await this.ensureStats(manager, userId, profile.timezone);
      await this.reconcileBalance(manager, stats);
    });
    const rows = await this.dataSource.getRepository(UserDailyMission).find({
      where: { userId, date },
      relations: { mission: true },
      order: { mission: { code: 'ASC' } },
    });
    return rows.map((row) => ({
      id: row.mission.id,
      code: row.mission.code,
      title: row.mission.title,
      date,
      currentProgress: row.currentProgress,
      targetCount: row.mission.targetCount,
      pointsReward: row.mission.pointsReward,
      completed: row.currentProgress >= row.mission.targetCount,
      rewardGranted: row.isClaimed,
    }));
  }

  async processPendingForUser(userId: string): Promise<number> {
    const candidates = await this.outbox.find({
      where: { aggregateType: 'meal_log', processedAt: IsNull() },
      order: { occurredAt: 'ASC' },
      take: 100,
    });
    let processed = 0;
    for (const candidate of candidates) {
      if (candidate.payload.userId !== userId) continue;
      try {
        await this.dataSource.transaction((manager) =>
          this.processEvent(manager, candidate.id, userId),
        );
        processed += 1;
      } catch (error) {
        await this.outbox.update(candidate.id, {
          attempts: candidate.attempts + 1,
          lastError:
            error instanceof Error ? error.message.slice(0, 1000) : 'error',
        });
      }
    }
    return processed;
  }

  async recordSocialReaction(userId: string): Promise<void> {
    const profile = await this.profiles.findOneByOrFail({ userId });
    const date = foodDateAt(new Date(), profile.timezone);
    await this.dataSource.transaction(async (manager) => {
      const mission = await manager.findOneBy(DailyMission, {
        code: 'REACT_TO_FRIEND_POST',
      });
      if (!mission) return;
      await this.award(manager, {
        userId,
        amount: mission.pointsReward,
        reason: PointTransactionReason.DAILY_MISSION_COMPLETED,
        idempotencyKey: `mission:${mission.id}:${date}`,
        sourceType: 'daily_mission',
        sourceId: mission.id,
        metadata: { code: mission.code, date },
      });
      await manager.getRepository(UserDailyMission).upsert(
        {
          userId,
          missionId: mission.id,
          date,
          currentProgress: mission.targetCount,
          isClaimed: true,
        },
        { conflictPaths: ['userId', 'missionId', 'date'] },
      );
      const stats = await this.ensureStats(manager, userId, profile.timezone);
      await this.reconcileBalance(manager, stats);
    });
  }

  private async processEvent(
    manager: EntityManager,
    eventId: string,
    userId: string,
  ): Promise<void> {
    const event = await manager.findOneBy(OutboxEvent, { id: eventId });
    if (!event || event.processedAt) return;
    const profile = await manager.findOneByOrFail(UserProfile, { userId });
    const stats = await this.ensureStats(manager, userId, profile.timezone);
    const meal = await manager.findOneBy(MealLog, {
      id: event.aggregateId,
      userId,
    });
    if (event.eventType === 'meal.logged' && meal && !meal.deletedAt) {
      await this.awardMealIfEligible(manager, meal);
      await this.publishMeal(manager, meal);
    }
    await this.recomputeStats(manager, stats);
    if (meal) {
      await this.evaluateMissions(
        manager,
        userId,
        foodDateAt(meal.consumedAt, meal.timezone),
      );
    }
    await this.evaluateAchievements(manager, stats);
    await this.reconcileBalance(manager, stats);
    event.processedAt = new Date();
    event.attempts += 1;
    event.lastError = null;
    await manager.save(OutboxEvent, event);
  }

  private async publishMeal(
    manager: EntityManager,
    meal: MealLog,
  ): Promise<void> {
    const memberships = await manager.findBy(GroupMember, {
      userId: meal.userId,
    });
    for (const membership of memberships) {
      const existing = await manager.findOneBy(FeedPost, {
        groupId: membership.groupId,
        mealLogId: meal.id,
      });
      if (!existing) {
        await manager.save(
          FeedPost,
          manager.create(FeedPost, {
            groupId: membership.groupId,
            userId: meal.userId,
            mealLogId: meal.id,
            content: null,
          }),
        );
      }
    }
  }

  private async awardMealIfEligible(
    manager: EntityManager,
    meal: MealLog,
  ): Promise<void> {
    const date = foodDateAt(meal.consumedAt, meal.timezone);
    const meals = (
      await manager.find(MealLog, {
        where: { userId: meal.userId, deletedAt: IsNull() },
        order: { consumedAt: 'ASC', id: 'ASC' },
      })
    ).filter((entry) => foodDateAt(entry.consumedAt, entry.timezone) === date);
    if (
      !meals
        .slice(0, SCORING_RULES_V1.maxAwardedMealsPerFoodDate)
        .some((entry) => entry.id === meal.id)
    ) {
      return;
    }
    await this.award(manager, {
      userId: meal.userId,
      amount: SCORING_RULES_V1.mealLogPoints,
      reason: PointTransactionReason.MEAL_LOG_STREAK,
      idempotencyKey: `meal:${meal.id}:${SCORING_RULES_V1.version}`,
      sourceType: 'meal_log',
      sourceId: meal.id,
      metadata: { foodDate: date, scoringVersion: SCORING_RULES_V1.version },
    });
  }

  private async ensureStats(
    manager: EntityManager,
    userId: string,
    timezone: string,
  ): Promise<UserStats> {
    const repository = manager.getRepository(UserStats);
    const existing = await repository.findOneBy({ userId });
    if (existing) return existing;
    return repository.save(
      repository.create({
        userId,
        currentStreak: 0,
        bestStreak: 0,
        totalPoints: 0,
        lastActivityAt: null,
        lastActivityDate: null,
        timezone,
      }),
    );
  }

  private async recomputeStats(
    manager: EntityManager,
    stats: UserStats,
  ): Promise<void> {
    const meals = await manager.find(MealLog, {
      where: { userId: stats.userId, deletedAt: IsNull() },
      order: { foodDate: 'ASC', consumedAt: 'ASC' },
    });
    const dates = [
      ...new Set(
        meals.map((meal) => foodDateAt(meal.consumedAt, meal.timezone)),
      ),
    ];
    let best = 0;
    let run = 0;
    let previous: string | null = null;
    for (const date of dates) {
      run = previous && this.daysBetween(previous, date) === 1 ? run + 1 : 1;
      best = Math.max(best, run);
      previous = date;
    }
    const latest = dates.at(-1) ?? null;
    const today = foodDateAt(new Date(), stats.timezone);
    stats.currentStreak =
      latest && this.daysBetween(latest, today) <= 1 ? run : 0;
    stats.bestStreak = Math.max(best, stats.currentStreak);
    stats.lastActivityDate = latest;
    stats.lastActivityAt = meals.at(-1)?.consumedAt ?? null;
    await manager.save(UserStats, stats);
  }

  private async evaluateMissions(
    manager: EntityManager,
    userId: string,
    date: string,
  ): Promise<void> {
    const missions = await manager.find(DailyMission);
    const mealCount = (
      await manager.find(MealLog, {
        where: { userId, deletedAt: IsNull() },
      })
    ).filter(
      (meal) => foodDateAt(meal.consumedAt, meal.timezone) === date,
    ).length;
    const snapshot = await manager.findOneBy(DailyNutritionSnapshot, {
      userId,
      foodDate: date,
    });
    const plan = await manager.findOneBy(DietPlan, {
      userId,
      status: DietPlanStatus.ACTIVE,
    });
    for (const mission of missions) {
      const repository = manager.getRepository(UserDailyMission);
      const row = await repository.findOneBy({
        userId,
        missionId: mission.id,
        date,
      });
      let currentProgress = row?.currentProgress ?? 0;
      if (mission.code === 'LOG_THREE_MEALS') {
        currentProgress = Math.min(mealCount, mission.targetCount);
      } else if (mission.code === 'HIT_PROTEIN_TARGET') {
        currentProgress =
          snapshot &&
          plan &&
          Number(snapshot.protein) >= Number(plan.targetProtein)
            ? 1
            : 0;
      }
      const completed = currentProgress >= mission.targetCount;
      if (completed) {
        await this.award(manager, {
          userId,
          amount: mission.pointsReward,
          reason: PointTransactionReason.DAILY_MISSION_COMPLETED,
          idempotencyKey: `mission:${mission.id}:${date}`,
          sourceType: 'daily_mission',
          sourceId: mission.id,
          metadata: { code: mission.code, date },
        });
      }
      await repository.upsert(
        {
          userId,
          missionId: mission.id,
          date,
          currentProgress,
          isClaimed: row?.isClaimed || completed,
        },
        { conflictPaths: ['userId', 'missionId', 'date'] },
      );
    }
  }

  private async evaluateAchievements(
    manager: EntityManager,
    stats: UserStats,
  ): Promise<void> {
    const mealCount = await manager.countBy(MealLog, {
      userId: stats.userId,
      deletedAt: IsNull(),
    });
    if (mealCount > 0) await this.unlock(manager, stats.userId, 'FIRST_MEAL');
    if (stats.bestStreak >= 3)
      await this.unlock(manager, stats.userId, 'STREAK_3');
    if (stats.bestStreak >= 7)
      await this.unlock(manager, stats.userId, 'STREAK_7');
  }

  private async unlock(
    manager: EntityManager,
    userId: string,
    code: string,
  ): Promise<void> {
    const achievement = await manager.findOneBy(Achievement, { code });
    if (!achievement) return;
    const existing = await manager.findOneBy(UserAchievement, {
      userId,
      achievementId: achievement.id,
    });
    if (existing) return;
    await manager.save(
      UserAchievement,
      manager.create(UserAchievement, {
        userId,
        achievementId: achievement.id,
        unlockedAt: new Date(),
      }),
    );
    const amount = SCORING_RULES_V1.achievementPoints[code] ?? 0;
    if (amount > 0) {
      await this.award(manager, {
        userId,
        amount,
        reason: PointTransactionReason.ACHIEVEMENT_UNLOCKED,
        idempotencyKey: `achievement:${achievement.id}:${SCORING_RULES_V1.version}`,
        sourceType: 'achievement',
        sourceId: achievement.id,
        metadata: { code, scoringVersion: SCORING_RULES_V1.version },
      });
    }
  }

  private async award(
    manager: EntityManager,
    input: LedgerInput,
  ): Promise<void> {
    const existing = await manager.findOneBy(PointTransaction, {
      userId: input.userId,
      idempotencyKey: input.idempotencyKey,
    });
    if (!existing) {
      await manager.save(
        PointTransaction,
        manager.create(PointTransaction, input),
      );
    }
  }

  private async reconcileBalance(
    manager: EntityManager,
    stats: UserStats,
  ): Promise<void> {
    stats.totalPoints = Number(
      (await manager.getRepository(PointTransaction).sum('amount', {
        userId: stats.userId,
      })) ?? 0,
    );
    await manager.save(UserStats, stats);
  }

  private daysBetween(from: string, to: string): number {
    return Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        86_400_000,
    );
  }
}
