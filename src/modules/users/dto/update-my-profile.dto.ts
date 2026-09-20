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
  @ApiPropertyOptional({ example: 'Nicolly', maxLength: 80, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @ApiPropertyOptional({ example: 'nicolly_28', minLength: 3, maxLength: 30 })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[a-zA-Z0-9_]+$/)
  username?: string;

  @ApiPropertyOptional({ format: 'date', example: '1998-04-12', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  dateOfBirth?: string | null;

  @ApiPropertyOptional({ enum: BiologicalSex, nullable: true })
  @IsOptional()
  @IsEnum(BiologicalSex)
  biologicalSex?: BiologicalSex | null;

  @ApiPropertyOptional({ enum: NutritionGoal, nullable: true })
  @IsOptional()
  @IsEnum(NutritionGoal)
  goal?: NutritionGoal | null;

  @ApiPropertyOptional({ enum: ActivityLevel, nullable: true })
  @IsOptional()
  @IsEnum(ActivityLevel)
  activityLevel?: ActivityLevel | null;

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

  @ApiPropertyOptional({ example: 62, minimum: 25, maximum: 400, nullable: true })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(25)
  @Max(400)
  targetWeightKg?: number | null;

  @ApiPropertyOptional({ format: 'date', example: '2027-03-01', nullable: true })
  @IsOptional()
  @IsISO8601({ strict: true })
  targetDate?: string | null;

  @ApiPropertyOptional({ example: 'Sem lactose', maxLength: 1000, nullable: true })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  dietaryRestrictions?: string | null;
}
