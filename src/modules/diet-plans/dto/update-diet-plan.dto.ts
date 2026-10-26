import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_NUTRITION_DECIMAL } from './create-diet-plan.dto';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class UpdateDietPlanDto {
  @ApiPropertyOptional({ example: 'Plano revisado', maxLength: 100 })
  @Transform(trim)
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 2300, minimum: 1 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INTEGER_MAX)
  targetCalories?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetProtein?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetCarbs?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetFat?: number;

  @ApiPropertyOptional({ minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetFiber?: number;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format',
  })
  startDate?: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate?: string | null;
}
