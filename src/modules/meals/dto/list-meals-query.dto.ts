import { IsISO8601, IsIn, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../shared/http/pagination.dto';

const sortFields = ['consumedAt', 'createdAt', 'name'] as const;
export type MealSortField = (typeof sortFields)[number];

export class ListMealsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsISO8601({ strict: true })
  to?: string;

  @ApiPropertyOptional({ enum: sortFields, default: 'consumedAt' })
  @IsOptional()
  @IsIn(sortFields)
  declare sortBy?: MealSortField;
}
