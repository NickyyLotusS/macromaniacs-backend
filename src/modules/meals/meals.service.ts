import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import {
  DataSource,
  EntityManager,
  In,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { MealInputMethod } from '../../integrations/database/entities/enums';
import { OutboxEvent } from '../../integrations/database/entities/events/outbox-event.entity';
import { MealLogItem } from '../../integrations/database/entities/meals/meal-log-item.entity';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { PlannedMeal } from '../../integrations/database/entities/nutrition/planned-meal.entity';
import {
  paginationMeta,
  SortDirection,
} from '../../shared/http/pagination.dto';
import { foodDateAt } from '../../shared/time/timezone';
import { PlannedNutritionCalculator } from '../diet-plans/planned-nutrition.calculator';
import { ProgressService } from '../progress/progress.service';
import { GamificationService } from '../gamification/gamification.service';
import type {
  CheckInPlannedMealDto,
  CreateManualMealDto,
} from './dto/create-meal.dto';
import type { ListMealsQueryDto } from './dto/list-meals-query.dto';
import type { MealItemInputDto } from './dto/meal-item.dto';
import {
  type MealListResponseDto,
  MealResponseDto,
} from './dto/meal-response.dto';
import type { UpdateMealDto } from './dto/update-meal.dto';

type DriverError = { code?: string; constraint?: string };

@Injectable()
export class MealsService {
  constructor(
    @InjectRepository(MealLog)
    private readonly meals: Repository<MealLog>,
    private readonly dataSource: DataSource,
    private readonly calculator: PlannedNutritionCalculator,
    private readonly progress: ProgressService,
    private readonly gamification: GamificationService,
  ) {}

  async createManual(
    userId: string,
    idempotencyValue: string | undefined,
    dto: CreateManualMealDto,
  ): Promise<MealResponseDto> {
    const idempotencyKey = this.idempotencyKey(idempotencyValue);
    const existing = await this.findByIdempotency(userId, idempotencyKey);
    if (existing) return MealResponseDto.from(existing);

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const context = await this.context(manager, userId, dto.consumedAt);
        await this.requireFoods(manager, dto.items);
        const meal = await manager.save(
          MealLog,
          manager.create(MealLog, {
            userId,
            plannedMealId: null,
            name: dto.name,
            photoUrl: dto.photoUrl ?? null,
            consumedAt: context.consumedAt,
            foodDate: context.foodDate,
            timezone: context.timezone,
            idempotencyKey,
            deletedAt: null,
          }),
        );
        meal.items = await this.replaceItems(
          manager,
          meal.id,
          dto.items,
          MealInputMethod.MANUAL,
        );
        await this.enqueue(manager, meal, 'meal.logged');
        await this.progress.recalculateWithManager(
          manager,
          userId,
          meal.foodDate,
          meal.timezone,
        );
        return meal.id;
      });
      await this.gamification.processPendingForUser(userId);
      return this.get(userId, id);
    } catch (error) {
      const duplicate = await this.duplicateResult(
        error,
        userId,
        idempotencyKey,
      );
      if (duplicate) return MealResponseDto.from(duplicate);
      throw error;
    }
  }

  async checkIn(
    userId: string,
    idempotencyValue: string | undefined,
    dto: CheckInPlannedMealDto,
  ): Promise<MealResponseDto> {
    const idempotencyKey = this.idempotencyKey(idempotencyValue);
    const existing = await this.findByIdempotency(userId, idempotencyKey);
    if (existing) return MealResponseDto.from(existing);

    try {
      const id = await this.dataSource.transaction(async (manager) => {
        const planned = await manager
          .getRepository(PlannedMeal)
          .createQueryBuilder('meal')
          .innerJoin('meal.dietPlan', 'plan')
          .leftJoinAndSelect('meal.items', 'item')
          .leftJoinAndSelect('item.food', 'food')
          .where('meal.id = :id', { id: dto.plannedMealId })
          .andWhere('plan.userId = :userId', { userId })
          .getOne();
        if (!planned) throw new NotFoundException('Planned meal not found');
        if (!planned.items?.length) {
          throw new BadRequestException('Planned meal has no items');
        }
        const context = await this.context(manager, userId, dto.consumedAt);
        const meal = await manager.save(
          MealLog,
          manager.create(MealLog, {
            userId,
            plannedMealId: planned.id,
            name: planned.name,
            photoUrl: null,
            consumedAt: context.consumedAt,
            foodDate: context.foodDate,
            timezone: context.timezone,
            idempotencyKey,
            deletedAt: null,
          }),
        );
        meal.items = await manager.save(
          MealLogItem,
          planned.items.map((item) =>
            manager.create(MealLogItem, {
              mealLogId: meal.id,
              foodId: item.foodId,
              amountGrams: item.amountGrams,
              calories: item.calories,
              protein: item.protein,
              carbs: item.carbs,
              fat: item.fat,
              fiber: item.fiber,
              inputMethod: MealInputMethod.PLANNED_MEAL,
            }),
          ),
        );
        await this.enqueue(manager, meal, 'meal.logged');
        await this.progress.recalculateWithManager(
          manager,
          userId,
          meal.foodDate,
          meal.timezone,
        );
        return meal.id;
      });
      await this.gamification.processPendingForUser(userId);
      return this.get(userId, id);
    } catch (error) {
      const duplicate = await this.duplicateResult(
        error,
        userId,
        idempotencyKey,
      );
      if (duplicate) return MealResponseDto.from(duplicate);
      throw error;
    }
  }

  async list(
    userId: string,
    query: ListMealsQueryDto,
  ): Promise<MealListResponseDto> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from must not be after to');
    }
    const builder = this.meals
      .createQueryBuilder('meal')
      .leftJoinAndSelect('meal.items', 'item')
      .leftJoinAndSelect('item.food', 'food')
      .where('meal.userId = :userId', { userId });
    if (query.from)
      builder.andWhere('meal.foodDate >= :from', { from: query.from });
    if (query.to) builder.andWhere('meal.foodDate <= :to', { to: query.to });
    const sortBy = query.sortBy ?? 'consumedAt';
    builder
      .orderBy(
        `meal.${sortBy}`,
        query.sortDirection === SortDirection.ASC ? 'ASC' : 'DESC',
      )
      .addOrderBy('item.id', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit);
    const [items, total] = await builder.getManyAndCount();
    return {
      items: items.map(MealResponseDto.from),
      meta: paginationMeta(total, query),
    };
  }

  async get(userId: string, id: string): Promise<MealResponseDto> {
    const meal = await this.meals.findOne({
      where: { id, userId },
      relations: { items: { food: true } },
      order: { items: { id: 'ASC' } },
    });
    if (!meal) throw new NotFoundException('Meal not found');
    return MealResponseDto.from(meal);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateMealDto,
  ): Promise<MealResponseDto> {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }
    await this.dataSource.transaction(async (manager) => {
      const meal = await this.ownedForUpdate(manager, userId, id);
      const previousDate = meal.foodDate;
      const previousTimezone = meal.timezone;
      if (dto.name !== undefined) meal.name = dto.name;
      if (dto.photoUrl !== undefined) meal.photoUrl = dto.photoUrl;
      if (dto.consumedAt !== undefined) {
        const context = await this.context(manager, userId, dto.consumedAt);
        meal.consumedAt = context.consumedAt;
        meal.foodDate = context.foodDate;
        meal.timezone = context.timezone;
      }
      await manager.save(MealLog, meal);
      if (dto.items) {
        meal.items = await this.replaceItems(
          manager,
          meal.id,
          dto.items,
          MealInputMethod.MANUAL,
        );
      }
      await this.enqueue(manager, meal, 'meal.updated');
      await this.progress.recalculateWithManager(
        manager,
        userId,
        previousDate,
        previousTimezone,
      );
      if (
        meal.foodDate !== previousDate ||
        meal.timezone !== previousTimezone
      ) {
        await this.progress.recalculateWithManager(
          manager,
          userId,
          meal.foodDate,
          meal.timezone,
        );
      }
    });
    await this.gamification.processPendingForUser(userId);
    return this.get(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const meal = await this.ownedForUpdate(manager, userId, id);
      meal.deletedAt = new Date();
      await manager.save(MealLog, meal);
      await this.enqueue(manager, meal, 'meal.deleted');
      await this.progress.recalculateWithManager(
        manager,
        userId,
        meal.foodDate,
        meal.timezone,
      );
    });
    await this.gamification.processPendingForUser(userId);
  }

  private async replaceItems(
    manager: EntityManager,
    mealId: string,
    inputs: MealItemInputDto[],
    inputMethod: MealInputMethod,
  ): Promise<MealLogItem[]> {
    const foodIds = [...new Set(inputs.map((input) => input.foodId))];
    const foods = await manager.findBy(Food, { id: In(foodIds) });
    const byId = new Map(foods.map((food) => [food.id, food]));
    if (foods.length !== foodIds.length) {
      throw new NotFoundException('One or more foods were not found');
    }
    await manager.delete(MealLogItem, { mealLogId: mealId });
    const items = inputs.map((input) => {
      const food = byId.get(input.foodId)!;
      const item = manager.create(MealLogItem, {
        mealLogId: mealId,
        foodId: food.id,
        amountGrams: input.amountGrams.toFixed(2),
        ...this.calculator.calculate(food, input.amountGrams),
        inputMethod,
      });
      item.food = food;
      return item;
    });
    return manager.save(MealLogItem, items);
  }

  private async requireFoods(
    manager: EntityManager,
    inputs: MealItemInputDto[],
  ): Promise<void> {
    const foodIds = [...new Set(inputs.map((input) => input.foodId))];
    const count = await manager.countBy(Food, { id: In(foodIds) });
    if (count !== foodIds.length) {
      throw new NotFoundException('One or more foods were not found');
    }
  }

  private async context(
    manager: EntityManager,
    userId: string,
    value?: string,
  ): Promise<{ consumedAt: Date; foodDate: string; timezone: string }> {
    const profile = await manager.findOneBy(UserProfile, { userId });
    if (!profile)
      throw new BadRequestException('User profile is not initialized');
    const consumedAt = value ? new Date(value) : new Date();
    if (Number.isNaN(consumedAt.getTime())) {
      throw new BadRequestException('consumedAt must be a valid instant');
    }
    return {
      consumedAt,
      foodDate: foodDateAt(consumedAt, profile.timezone),
      timezone: profile.timezone,
    };
  }

  private async ownedForUpdate(
    manager: EntityManager,
    userId: string,
    id: string,
  ): Promise<MealLog> {
    const meal = await manager
      .getRepository(MealLog)
      .createQueryBuilder('meal')
      .setLock('pessimistic_write')
      .where('meal.id = :id', { id })
      .andWhere('meal.userId = :userId', { userId })
      .getOne();
    if (!meal) throw new NotFoundException('Meal not found');
    meal.foodDate = foodDateAt(meal.consumedAt, meal.timezone);
    return meal;
  }

  private async enqueue(
    manager: EntityManager,
    meal: MealLog,
    eventType: string,
  ): Promise<void> {
    await manager.save(
      OutboxEvent,
      manager.create(OutboxEvent, {
        aggregateType: 'meal_log',
        aggregateId: meal.id,
        eventType,
        deduplicationKey: `${eventType}:${meal.id}:${randomUUID()}`,
        payload: {
          userId: meal.userId,
          mealId: meal.id,
          foodDate: meal.foodDate,
          timezone: meal.timezone,
        },
        processedAt: null,
        attempts: 0,
        lastError: null,
      }),
    );
  }

  private idempotencyKey(value: string | undefined): string {
    const key = value?.trim();
    if (!key || key.length > 128) {
      throw new BadRequestException(
        'Idempotency-Key header is required and must contain at most 128 characters',
      );
    }
    return key;
  }

  private findByIdempotency(
    userId: string,
    idempotencyKey: string,
  ): Promise<MealLog | null> {
    return this.meals.findOne({
      where: { userId, idempotencyKey },
      relations: { items: { food: true } },
    });
  }

  private async duplicateResult(
    error: unknown,
    userId: string,
    idempotencyKey: string,
  ): Promise<MealLog | null> {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as DriverError).code === '23505'
    ) {
      const existing = await this.findByIdempotency(userId, idempotencyKey);
      if (existing) return existing;
      throw new ConflictException('Duplicate meal request');
    }
    return null;
  }
}
