import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { MealLog } from '../../../integrations/database/entities/meals/meal-log.entity';
import type { MealLogItem } from '../../../integrations/database/entities/meals/meal-log-item.entity';
import { MealInputMethod } from '../../../integrations/database/entities/enums';
import { PaginationMetaDto } from '../../../shared/http/pagination.dto';
import { foodDateAt } from '../../../shared/time/timezone';

export class MealLogItemResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  foodId!: string | null;
  @ApiPropertyOptional({ nullable: true })
  foodName!: string | null;
  @ApiProperty() amountGrams!: number;
  @ApiProperty() calories!: number;
  @ApiProperty() protein!: number;
  @ApiProperty() carbs!: number;
  @ApiProperty() fat!: number;
  @ApiProperty() fiber!: number;
  @ApiProperty({ enum: MealInputMethod })
  inputMethod!: MealInputMethod;

  static from(item: MealLogItem): MealLogItemResponseDto {
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
      inputMethod: item.inputMethod,
    };
  }
}

export class MealTotalsResponseDto {
  @ApiProperty() calories!: number;
  @ApiProperty() protein!: number;
  @ApiProperty() carbs!: number;
  @ApiProperty() fat!: number;
  @ApiProperty() fiber!: number;
}

export class MealResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  plannedMealId!: string | null;
  @ApiProperty() name!: string;
  @ApiPropertyOptional({ nullable: true }) photoUrl!: string | null;
  @ApiProperty({ format: 'date-time' }) consumedAt!: string;
  @ApiProperty({ format: 'date' }) foodDate!: string;
  @ApiProperty() timezone!: string;
  @ApiProperty({ type: [MealLogItemResponseDto] })
  items!: MealLogItemResponseDto[];
  @ApiProperty({ type: MealTotalsResponseDto }) totals!: MealTotalsResponseDto;
  @ApiProperty({ format: 'date-time' }) createdAt!: string;
  @ApiProperty({ format: 'date-time' }) updatedAt!: string;

  static from(meal: MealLog): MealResponseDto {
    const items = meal.items ?? [];
    const sum = (field: keyof MealTotalsResponseDto) =>
      Math.round(
        items.reduce((total, item) => total + Number(item[field]), 0) * 100,
      ) / 100;
    return {
      id: meal.id,
      plannedMealId: meal.plannedMealId,
      name: meal.name,
      photoUrl: meal.photoUrl,
      consumedAt: meal.consumedAt.toISOString(),
      foodDate: foodDateAt(meal.consumedAt, meal.timezone),
      timezone: meal.timezone,
      items: items.map(MealLogItemResponseDto.from),
      totals: {
        calories: sum('calories'),
        protein: sum('protein'),
        carbs: sum('carbs'),
        fat: sum('fat'),
        fiber: sum('fiber'),
      },
      createdAt: meal.createdAt.toISOString(),
      updatedAt: meal.updatedAt.toISOString(),
    };
  }
}

export class MealListResponseDto {
  @ApiProperty({ type: [MealResponseDto] }) items!: MealResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta!: PaginationMetaDto;
}
