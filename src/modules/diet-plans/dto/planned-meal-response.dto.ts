import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { PlannedMeal } from '../../../integrations/database/entities/nutrition/planned-meal.entity';
import type { PlannedMealItem } from '../../../integrations/database/entities/nutrition/planned-meal-item.entity';
import type { PlannedNutritionCalculator } from '../planned-nutrition.calculator';

export class NutritionTotalsDto {
  @ApiProperty({ example: 640.25 })
  calories!: number;

  @ApiProperty({ example: 42.5 })
  protein!: number;

  @ApiProperty({ example: 75.25 })
  carbs!: number;

  @ApiProperty({ example: 18.75 })
  fat!: number;

  @ApiProperty({ example: 9.5 })
  fiber!: number;
}

export class PlannedMealItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  foodId!: string | null;

  @ApiPropertyOptional({ example: 'Aveia em flocos', nullable: true })
  foodName!: string | null;

  @ApiProperty({ example: 120.5 })
  amountGrams!: number;

  @ApiProperty({ example: 467.54 })
  calories!: number;

  @ApiProperty({ example: 20.36 })
  protein!: number;

  @ApiProperty({ example: 79.05 })
  carbs!: number;

  @ApiProperty({ example: 8.31 })
  fat!: number;

  @ApiProperty({ example: 12.66 })
  fiber!: number;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(item: PlannedMealItem): PlannedMealItemResponseDto {
    return {
      id: item.id,
      foodId: item.foodId,
      foodName: item.food?.name ?? null,
      amountGrams: Number(item.amountGrams),
      calories: Number(item.calories),
      protein: Number(item.protein),
      carbs: Number(item.carbs),
      fat: Number(item.fat),
      fiber: Number(item.fiber),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export class PlannedMealResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Café da manhã' })
  name!: string;

  @ApiProperty({ example: 1 })
  orderIndex!: number;

  @ApiPropertyOptional({ example: 500, nullable: true })
  targetCalories!: number | null;

  @ApiPropertyOptional({ example: 30, nullable: true })
  targetProtein!: number | null;

  @ApiPropertyOptional({ example: 65, nullable: true })
  targetCarbs!: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true })
  targetFat!: number | null;

  @ApiProperty({ type: NutritionTotalsDto })
  totals!: NutritionTotalsDto;

  @ApiProperty({ type: () => [PlannedMealItemResponseDto] })
  items!: PlannedMealItemResponseDto[];

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(
    meal: PlannedMeal,
    calculator: PlannedNutritionCalculator,
  ): PlannedMealResponseDto {
    const items = meal.items ?? [];
    return {
      id: meal.id,
      name: meal.name,
      orderIndex: meal.orderIndex,
      targetCalories: meal.targetCalories,
      targetProtein:
        meal.targetProtein === null ? null : Number(meal.targetProtein),
      targetCarbs: meal.targetCarbs === null ? null : Number(meal.targetCarbs),
      targetFat: meal.targetFat === null ? null : Number(meal.targetFat),
      totals: totals(items, calculator),
      items: items.map(PlannedMealItemResponseDto.from),
      createdAt: meal.createdAt.toISOString(),
      updatedAt: meal.updatedAt.toISOString(),
    };
  }
}

export class PlannedMealsResponseDto {
  @ApiProperty({ format: 'uuid' })
  planId!: string;

  @ApiProperty({ type: NutritionTotalsDto })
  totals!: NutritionTotalsDto;

  @ApiProperty({ type: () => [PlannedMealResponseDto] })
  meals!: PlannedMealResponseDto[];
}

export function totals(
  items: readonly PlannedMealItem[],
  calculator: PlannedNutritionCalculator,
): NutritionTotalsDto {
  return {
    calories: calculator.sum(items.map((item) => item.calories)),
    protein: calculator.sum(items.map((item) => item.protein)),
    carbs: calculator.sum(items.map((item) => item.carbs)),
    fat: calculator.sum(items.map((item) => item.fat)),
    fiber: calculator.sum(items.map((item) => item.fiber)),
  };
}
