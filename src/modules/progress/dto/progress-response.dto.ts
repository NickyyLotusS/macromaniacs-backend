import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { DailyNutritionSnapshot } from '../../../integrations/database/entities/nutrition/daily-nutrition-snapshot.entity';
import { PaginationMetaDto } from '../../../shared/http/pagination.dto';
import { normalizeDateColumn } from '../../../shared/time/timezone';

export class DailyProgressResponseDto {
  @ApiProperty({ format: 'date' })
  date!: string;

  @ApiProperty({ example: 'America/Sao_Paulo' })
  timezone!: string;

  @ApiProperty({ example: 1800.5 })
  calories!: number;

  @ApiProperty({ example: 120.25 })
  protein!: number;

  @ApiProperty({ example: 210.5 })
  carbs!: number;

  @ApiProperty({ example: 60.25 })
  fat!: number;

  @ApiProperty({ example: 28 })
  fiber!: number;

  @ApiProperty({ example: 4 })
  mealCount!: number;

  @ApiPropertyOptional({ example: 2100, nullable: true })
  targetCalories!: number | null;

  @ApiPropertyOptional({ example: 85.74, nullable: true })
  calorieProgressPercent!: number | null;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(snapshot: DailyNutritionSnapshot): DailyProgressResponseDto {
    const calories = Number(snapshot.calories);
    return {
      date: normalizeDateColumn(snapshot.foodDate as string | Date),
      timezone: snapshot.timezone,
      calories,
      protein: Number(snapshot.protein),
      carbs: Number(snapshot.carbs),
      fat: Number(snapshot.fat),
      fiber: Number(snapshot.fiber),
      mealCount: snapshot.mealCount,
      targetCalories: snapshot.targetCalories,
      calorieProgressPercent: snapshot.targetCalories
        ? Math.round((calories / snapshot.targetCalories) * 10_000) / 100
        : null,
      updatedAt: snapshot.updatedAt.toISOString(),
    };
  }
}

export class ProgressHistoryResponseDto {
  @ApiProperty({ type: [DailyProgressResponseDto] })
  items!: DailyProgressResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
