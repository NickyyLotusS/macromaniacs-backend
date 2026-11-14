import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, EntityManager, Repository } from 'typeorm';
import { DailyNutritionSnapshot } from '../../integrations/database/entities/nutrition/daily-nutrition-snapshot.entity';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { DietPlanStatus } from '../../integrations/database/entities/enums';
import {
  BiologicalSex as DatabaseBiologicalSex,
  UserGoal,
} from '../../integrations/database/entities/enums';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { foodDateAt } from '../../shared/time/timezone';
import { paginationMeta } from '../../shared/http/pagination.dto';
import type { ProgressHistoryQueryDto } from './dto/progress-query.dto';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from '../users/domain/profile.enums';
import { NutritionCalculatorService } from '../users/nutrition-calculator.service';
import {
  DailyProgressResponseDto,
  type ProgressHistoryResponseDto,
} from './dto/progress-response.dto';

const PROFILE_GOALS: Readonly<Record<UserGoal, NutritionGoal>> = {
  [UserGoal.WEIGHT_LOSS]: NutritionGoal.LOSE_WEIGHT,
  [UserGoal.MUSCLE_GAIN]: NutritionGoal.GAIN_MUSCLE,
  [UserGoal.STRENGTH_GAIN]: NutritionGoal.GAIN_STRENGTH,
  [UserGoal.MAINTENANCE]: NutritionGoal.MAINTAIN,
  [UserGoal.RECOMPOSITION]: NutritionGoal.RECOMPOSITION,
  [UserGoal.PERFORMANCE]: NutritionGoal.PERFORMANCE,
};

@Injectable()
export class ProgressService {
  constructor(
    @InjectRepository(DailyNutritionSnapshot)
    private readonly snapshots: Repository<DailyNutritionSnapshot>,
    @InjectRepository(UserProfile)
    private readonly profiles: Repository<UserProfile>,
    private readonly nutritionCalculator: NutritionCalculatorService,
  ) {}

  async daily(
    userId: string,
    date?: string,
  ): Promise<DailyProgressResponseDto> {
    const timezone = await this.timezone(userId);
    const foodDate = date ?? foodDateAt(new Date(), timezone);
    this.assertDate(foodDate);
    const snapshot =
      (await this.snapshots.findOneBy({ userId, foodDate })) ??
      (await this.snapshots.manager.transaction((manager) =>
        this.recalculateWithManager(manager, userId, foodDate, timezone),
      ));
    return DailyProgressResponseDto.from(snapshot);
  }

  async history(
    userId: string,
    query: ProgressHistoryQueryDto,
  ): Promise<ProgressHistoryResponseDto> {
    const from = query.from ?? '0001-01-01';
    const to = query.to ?? '9999-12-31';
    this.assertDateRange(from, to);
    const [items, total] = await this.snapshots.findAndCount({
      where: { userId, foodDate: Between(from, to) },
      order: { foodDate: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return {
      items: items.map(DailyProgressResponseDto.from),
      meta: paginationMeta(total, query),
    };
  }

  async reprocess(
    userId: string,
    date?: string,
  ): Promise<DailyProgressResponseDto> {
    const timezone = await this.timezone(userId);
    const foodDate = date ?? foodDateAt(new Date(), timezone);
    this.assertDate(foodDate);
    const snapshot = await this.snapshots.manager.transaction((manager) =>
      this.recalculateWithManager(manager, userId, foodDate, timezone),
    );
    return DailyProgressResponseDto.from(snapshot);
  }

  async recalculateWithManager(
    manager: EntityManager,
    userId: string,
    foodDate: string,
    timezone: string,
  ): Promise<DailyNutritionSnapshot> {
    const meals = await manager
      .getRepository(MealLog)
      .createQueryBuilder('meal')
      .leftJoinAndSelect('meal.items', 'item')
      .where('meal.userId = :userId', { userId })
      .andWhere('meal.foodDate = :foodDate', { foodDate })
      .andWhere('meal.deletedAt IS NULL')
      .getMany();
    const items = meals.flatMap((meal) => meal.items ?? []);
    const sum = (field: 'calories' | 'protein' | 'carbs' | 'fat' | 'fiber') =>
      items.reduce((total, item) => total + Number(item[field]), 0);
    const plan = await manager.findOne(DietPlan, {
      where: { userId, status: DietPlanStatus.ACTIVE },
      order: { updatedAt: 'DESC' },
    });
    const profile = plan
      ? null
      : await manager.findOneByOrFail(UserProfile, { userId });
    const repository = manager.getRepository(DailyNutritionSnapshot);
    const values = {
      userId,
      foodDate,
      timezone,
      calories: this.decimal(sum('calories')),
      protein: this.decimal(sum('protein')),
      carbs: this.decimal(sum('carbs')),
      fat: this.decimal(sum('fat')),
      fiber: this.decimal(sum('fiber')),
      mealCount: meals.length,
      targetCalories:
        plan?.targetCalories ?? this.profileCalorieTarget(profile),
    };
    await repository.upsert(values, {
      conflictPaths: ['userId', 'foodDate'],
      skipUpdateIfNoValuesChanged: false,
    });
    const snapshot = await repository.findOneByOrFail({ userId, foodDate });
    snapshot.foodDate = foodDate;
    return snapshot;
  }

  private async timezone(userId: string): Promise<string> {
    return (await this.profiles.findOneByOrFail({ userId })).timezone;
  }

  private decimal(value: string | number | null | undefined): string {
    return Number(value ?? 0).toFixed(2);
  }

  private profileCalorieTarget(profile: UserProfile | null): number | null {
    if (
      !profile?.birthDate ||
      !profile.heightCm ||
      !profile.currentWeightKg ||
      !profile.activityLevel ||
      !profile.biologicalSex ||
      profile.biologicalSex === DatabaseBiologicalSex.NOT_INFORMED ||
      !profile.goal
    ) {
      return null;
    }

    const goal = PROFILE_GOALS[profile.goal];
    return this.nutritionCalculator.calculate({
      dateOfBirth: profile.birthDate,
      biologicalSex:
        profile.biologicalSex === DatabaseBiologicalSex.MALE
          ? BiologicalSex.MALE
          : BiologicalSex.FEMALE,
      heightCm: Number(profile.heightCm),
      currentWeightKg: Number(profile.currentWeightKg),
      goal,
      activityLevel: profile.activityLevel as unknown as ActivityLevel,
      targetWeightKg:
        profile.targetWeightKg === null ? null : Number(profile.targetWeightKg),
      targetDate: profile.targetDate,
    }).calorieTargetKcalPerDay;
  }

  private assertDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      throw new BadRequestException('date must be a valid ISO date');
    }
  }

  private assertDateRange(from: string, to: string): void {
    this.assertDate(from);
    this.assertDate(to);
    if (from > to) throw new BadRequestException('from must not be after to');
  }
}
