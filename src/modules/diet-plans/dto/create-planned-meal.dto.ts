import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MAX_NUTRITION_DECIMAL } from './create-diet-plan.dto';

const POSTGRES_INTEGER_MAX = 2_147_483_647;
const trim = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() : value;

export class CreatePlannedMealDto {
  @ApiProperty({ example: 'Café da manhã', maxLength: 100 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(POSTGRES_INTEGER_MAX)
  orderIndex!: number;

  @ApiPropertyOptional({ example: 500, nullable: true, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(POSTGRES_INTEGER_MAX)
  targetCalories?: number | null;

  @ApiPropertyOptional({ example: 30, nullable: true, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetProtein?: number | null;

  @ApiPropertyOptional({ example: 65, nullable: true, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetCarbs?: number | null;

  @ApiPropertyOptional({ example: 15, nullable: true, minimum: 0 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_NUTRITION_DECIMAL)
  targetFat?: number | null;
}
