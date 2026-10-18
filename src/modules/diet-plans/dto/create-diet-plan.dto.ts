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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const MAX_NUTRITION_DECIMAL = 9_999.99;
const POSTGRES_INTEGER_MAX = 2_147_483_647;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreateDietPlanDto {
  @ApiProperty({ example: 'Plano de manutenção', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  title!: string;

  @ApiProperty({ example: 2200, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INTEGER_MAX)
  targetCalories!: number;

  @ApiProperty({ example: 150, minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetProtein!: number;

  @ApiProperty({ example: 250, minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetCarbs!: number;

  @ApiProperty({ example: 70, minimum: 0, maximum: MAX_NUTRITION_DECIMAL })
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetFat!: number;

  @ApiPropertyOptional({
    example: 30,
    default: 0,
    minimum: 0,
    maximum: MAX_NUTRITION_DECIMAL,
  })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetFiber = 0;

  @ApiPropertyOptional({ format: 'date', example: '2026-10-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must use YYYY-MM-DD format',
  })
  startDate?: string | null;

  @ApiPropertyOptional({ format: 'date', example: '2026-11-20' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate must use YYYY-MM-DD format',
  })
  endDate?: string | null;
}
