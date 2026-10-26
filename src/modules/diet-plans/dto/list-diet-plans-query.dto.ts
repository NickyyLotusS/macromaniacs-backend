import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { DietPlanStatus } from '../../../integrations/database/entities/enums';
import { PaginationQueryDto } from '../../../shared/http/pagination.dto';

export const DIET_PLAN_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
] as const;

export type DietPlanSortField = (typeof DIET_PLAN_SORT_FIELDS)[number];

export class ListDietPlansQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: DietPlanStatus })
  @IsOptional()
  @IsEnum(DietPlanStatus)
  status?: DietPlanStatus;

  @ApiPropertyOptional({
    enum: DIET_PLAN_SORT_FIELDS,
    default: 'createdAt',
  })
  @IsOptional()
  @IsIn(DIET_PLAN_SORT_FIELDS)
  declare sortBy?: DietPlanSortField;
}
