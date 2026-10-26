import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { PlannedMeal } from '../../integrations/database/entities/nutrition/planned-meal.entity';
import { PlannedMealItem } from '../../integrations/database/entities/nutrition/planned-meal-item.entity';
import type { CreatePlannedMealDto } from './dto/create-planned-meal.dto';
import type {
  CreatePlannedMealItemDto,
  UpdatePlannedMealItemDto,
} from './dto/planned-meal-item.dto';
import {
  PlannedMealItemResponseDto,
  PlannedMealResponseDto,
  type PlannedMealsResponseDto,
  totals,
} from './dto/planned-meal-response.dto';
import type { UpdatePlannedMealDto } from './dto/update-planned-meal.dto';
import { PlannedNutritionCalculator } from './planned-nutrition.calculator';

@Injectable()
export class PlannedMealsService {
  constructor(
    @InjectRepository(DietPlan)
    private readonly plans: Repository<DietPlan>,
    @InjectRepository(PlannedMeal)
    private readonly meals: Repository<PlannedMeal>,
    @InjectRepository(PlannedMealItem)
    private readonly items: Repository<PlannedMealItem>,
    @InjectRepository(Food)
    private readonly foods: Repository<Food>,
    private readonly calculator: PlannedNutritionCalculator,
  ) {}

  async list(userId: string, planId: string): Promise<PlannedMealsResponseDto> {
    const plan = await this.plans
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.meals', 'meal')
      .leftJoinAndSelect('meal.items', 'item')
      .leftJoinAndSelect('item.food', 'food')
      .where('plan.id = :planId', { planId })
      .andWhere('plan.userId = :userId', { userId })
      .orderBy('meal.orderIndex', 'ASC')
      .addOrderBy('item.createdAt', 'ASC')
      .getOne();
    if (!plan) throw new NotFoundException('Diet plan not found');

    const meals = plan.meals ?? [];
    const allItems = meals.flatMap((meal) => meal.items ?? []);
    return {
      planId: plan.id,
      totals: totals(allItems, this.calculator),
      meals: meals.map((meal) =>
        PlannedMealResponseDto.from(meal, this.calculator),
      ),
    };
  }

  async createMeal(
    userId: string,
    planId: string,
    dto: CreatePlannedMealDto,
  ): Promise<PlannedMealResponseDto> {
    await this.ownedPlan(userId, planId);
    await this.ensureOrderAvailable(planId, dto.orderIndex);
    const meal = this.meals.create({
      dietPlanId: planId,
      name: dto.name,
      orderIndex: dto.orderIndex,
      targetCalories: dto.targetCalories ?? null,
      targetProtein: this.optionalDecimal(dto.targetProtein),
      targetCarbs: this.optionalDecimal(dto.targetCarbs),
      targetFat: this.optionalDecimal(dto.targetFat),
    });
    meal.items = [];
    try {
      return PlannedMealResponseDto.from(
        await this.meals.save(meal),
        this.calculator,
      );
    } catch (error) {
      this.throwOrderConflict(error);
    }
  }

  async updateMeal(
    userId: string,
    planId: string,
    mealId: string,
    dto: UpdatePlannedMealDto,
  ): Promise<PlannedMealResponseDto> {
    this.assertPatch(dto);
    const meal = await this.ownedMeal(userId, planId, mealId, true);
    if (dto.orderIndex !== undefined && dto.orderIndex !== meal.orderIndex) {
      await this.ensureOrderAvailable(planId, dto.orderIndex);
      meal.orderIndex = dto.orderIndex;
    }
    if (dto.name !== undefined) meal.name = dto.name;
    if (dto.targetCalories !== undefined)
      meal.targetCalories = dto.targetCalories;
    if (dto.targetProtein !== undefined)
      meal.targetProtein = this.optionalDecimal(dto.targetProtein);
    if (dto.targetCarbs !== undefined)
      meal.targetCarbs = this.optionalDecimal(dto.targetCarbs);
    if (dto.targetFat !== undefined)
      meal.targetFat = this.optionalDecimal(dto.targetFat);
    try {
      return PlannedMealResponseDto.from(
        await this.meals.save(meal),
        this.calculator,
      );
    } catch (error) {
      this.throwOrderConflict(error);
    }
  }

  async deleteMeal(
    userId: string,
    planId: string,
    mealId: string,
  ): Promise<void> {
    const meal = await this.ownedMeal(userId, planId, mealId);
    await this.meals.remove(meal);
  }

  async createItem(
    userId: string,
    planId: string,
    mealId: string,
    dto: CreatePlannedMealItemDto,
  ): Promise<PlannedMealItemResponseDto> {
    await this.ownedMeal(userId, planId, mealId);
    const food = await this.food(dto.foodId);
    const item = this.items.create({
      plannedMealId: mealId,
      foodId: food.id,
      amountGrams: dto.amountGrams.toFixed(2),
      ...this.calculator.calculate(food, dto.amountGrams),
    });
    item.food = food;
    return PlannedMealItemResponseDto.from(await this.items.save(item));
  }

  async updateItem(
    userId: string,
    planId: string,
    mealId: string,
    itemId: string,
    dto: UpdatePlannedMealItemDto,
  ): Promise<PlannedMealItemResponseDto> {
    this.assertPatch(dto);
    const item = await this.ownedItem(userId, planId, mealId, itemId);
    const food = await this.food(dto.foodId ?? item.foodId);
    const amountGrams = dto.amountGrams ?? Number(item.amountGrams);
    Object.assign(item, {
      foodId: food.id,
      food,
      amountGrams: amountGrams.toFixed(2),
      ...this.calculator.calculate(food, amountGrams),
    });
    return PlannedMealItemResponseDto.from(await this.items.save(item));
  }

  async deleteItem(
    userId: string,
    planId: string,
    mealId: string,
    itemId: string,
  ): Promise<void> {
    const item = await this.ownedItem(userId, planId, mealId, itemId);
    await this.items.remove(item);
  }

  private async ownedPlan(userId: string, planId: string): Promise<DietPlan> {
    const plan = await this.plans.findOneBy({ id: planId, userId });
    if (!plan) throw new NotFoundException('Diet plan not found');
    return plan;
  }

  private async ownedMeal(
    userId: string,
    planId: string,
    mealId: string,
    withItems = false,
  ): Promise<PlannedMeal> {
    const query = this.meals
      .createQueryBuilder('meal')
      .innerJoin('meal.dietPlan', 'plan')
      .where('meal.id = :mealId', { mealId })
      .andWhere('meal.dietPlanId = :planId', { planId })
      .andWhere('plan.userId = :userId', { userId });
    if (withItems) {
      query
        .leftJoinAndSelect('meal.items', 'item')
        .leftJoinAndSelect('item.food', 'food');
    }
    const meal = await query.getOne();
    if (!meal) throw new NotFoundException('Planned meal not found');
    return meal;
  }

  private async ownedItem(
    userId: string,
    planId: string,
    mealId: string,
    itemId: string,
  ): Promise<PlannedMealItem> {
    const item = await this.items
      .createQueryBuilder('item')
      .innerJoin('item.plannedMeal', 'meal')
      .innerJoin('meal.dietPlan', 'plan')
      .leftJoinAndSelect('item.food', 'food')
      .where('item.id = :itemId', { itemId })
      .andWhere('item.plannedMealId = :mealId', { mealId })
      .andWhere('meal.dietPlanId = :planId', { planId })
      .andWhere('plan.userId = :userId', { userId })
      .getOne();
    if (!item) throw new NotFoundException('Planned meal item not found');
    return item;
  }

  private async food(foodId: string | null): Promise<Food> {
    if (!foodId) throw new BadRequestException('Item food no longer exists');
    const food = await this.foods.findOneBy({ id: foodId });
    if (!food) throw new NotFoundException('Food not found');
    return food;
  }

  private async ensureOrderAvailable(
    planId: string,
    orderIndex: number,
  ): Promise<void> {
    if (await this.meals.findOneBy({ dietPlanId: planId, orderIndex })) {
      throw new ConflictException(
        'orderIndex already exists in this diet plan',
      );
    }
  }

  private optionalDecimal(value: number | null | undefined): string | null {
    return value === null || value === undefined ? null : value.toFixed(2);
  }

  private assertPatch(dto: object): void {
    if (Object.values(dto).every((value) => value === undefined)) {
      throw new BadRequestException('At least one field must be provided');
    }
  }

  private throwOrderConflict(error: unknown): never {
    if (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    ) {
      throw new ConflictException(
        'orderIndex already exists in this diet plan',
      );
    }
    throw error;
  }
}
