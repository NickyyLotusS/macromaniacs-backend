import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DietPlanStatus } from '../../../integrations/database/entities/enums';
import type { DietPlan } from '../../../integrations/database/entities/nutrition/diet-plan.entity';
import { PaginationMetaDto } from '../../../shared/http/pagination.dto';

export class DietPlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Plano de manutenção' })
  title!: string;

  @ApiProperty({ enum: DietPlanStatus })
  status!: DietPlanStatus;

  @ApiProperty({ example: 2200 })
  targetCalories!: number;

  @ApiProperty({ example: 150 })
  targetProtein!: number;

  @ApiProperty({ example: 250 })
  targetCarbs!: number;

  @ApiProperty({ example: 70 })
  targetFat!: number;

  @ApiProperty({ example: 30 })
  targetFiber!: number;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  startDate!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  endDate!: string | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(plan: DietPlan): DietPlanResponseDto {
    return {
      id: plan.id,
      title: plan.title,
      status: plan.status,
      targetCalories: plan.targetCalories,
      targetProtein: Number(plan.targetProtein),
      targetCarbs: Number(plan.targetCarbs),
      targetFat: Number(plan.targetFat),
      targetFiber: Number(plan.targetFiber),
      startDate: plan.startDate,
      endDate: plan.endDate,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }
}

export class DietPlanListResponseDto {
  @ApiProperty({ type: () => [DietPlanResponseDto] })
  items!: DietPlanResponseDto[];

  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}
