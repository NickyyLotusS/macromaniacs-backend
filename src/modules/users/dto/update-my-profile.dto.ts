import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from '../domain/profile.enums';

const trimOrNull = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? value.trim() || null : value;

export class UpdateMyProfileDto {
  @ApiPropertyOptional({ example: 'Nicolly', maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ example: 'nicolly_28', minLength: 3, maxLength: 50 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Length(3, 50)
  @Matches(/^[a-z0-9_]+$/)
  username?: string;

  @ApiPropertyOptional({ format: 'date', example: '1998-04-12' })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: BiologicalSex })
  @IsOptional()
  @IsEnum(BiologicalSex)
  biologicalSex?: BiologicalSex;

  @ApiPropertyOptional({ enum: NutritionGoal })
  @IsOptional()
  @IsEnum(NutritionGoal)
  goal?: NutritionGoal;

  @ApiPropertyOptional({ enum: ActivityLevel })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel;

  @ApiPropertyOptional({ example: 165, minimum: 80, maximum: 250 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(80)
  @Max(250)
  heightCm?: number;

  @ApiPropertyOptional({ example: 68.5, minimum: 25, maximum: 400 })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(400)
  currentWeightKg?: number;

  @ApiPropertyOptional({
    example: 62,
    minimum: 25,
    maximum: 400,
    nullable: true,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(400)
  targetWeightKg?: number | null;

  @ApiPropertyOptional({
    format: 'date',
    example: '2027-03-01',
    nullable: true,
  })
  @IsOptional()
  @IsISO8601({ strict: true })
  targetDate?: string | null;

  @ApiPropertyOptional({
    example: 'Sem lactose',
    maxLength: 1000,
    nullable: true,
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dietaryRestrictions?: string | null;
}
