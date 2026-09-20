import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from '../domain/profile.enums';

export class BodyMeasurementResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 165, description: 'Altura em centímetros' })
  heightCm!: number;

  @ApiProperty({ example: 68.5, description: 'Peso em quilogramas' })
  weightKg!: number;

  @ApiProperty({ format: 'date-time' })
  measuredAt!: string;
}

export class NutritionMetricsResponseDto {
  @ApiProperty({ example: 28 })
  ageYears!: number;

  @ApiProperty({ example: 1450, description: 'TMB em kcal/dia' })
  bmrKcalPerDay!: number;

  @ApiProperty({ example: 2248, description: 'TDEE em kcal/dia' })
  tdeeKcalPerDay!: number;

  @ApiProperty({ example: 2023, description: 'Meta energética em kcal/dia' })
  calorieTargetKcalPerDay!: number;

  @ApiProperty({ format: 'date-time' })
  calculatedAt!: string;
}

export class MyProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'macro_user' })
  username!: string;

  @ApiPropertyOptional({ example: 'Nicolly', nullable: true })
  displayName!: string | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiPropertyOptional({ enum: BiologicalSex, nullable: true })
  biologicalSex!: BiologicalSex | null;

  @ApiPropertyOptional({ enum: NutritionGoal, nullable: true })
  goal!: NutritionGoal | null;

  @ApiPropertyOptional({ enum: ActivityLevel, nullable: true })
  activityLevel!: ActivityLevel | null;

  @ApiPropertyOptional({ example: 62, nullable: true })
  targetWeightKg!: number | null;

  @ApiPropertyOptional({ format: 'date', nullable: true })
  targetDate!: string | null;

  @ApiPropertyOptional({ example: 'Sem lactose', nullable: true })
  dietaryRestrictions!: string | null;

  @ApiProperty({ example: false })
  onboardingCompleted!: boolean;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  onboardingCompletedAt!: string | null;

  @ApiPropertyOptional({ type: BodyMeasurementResponseDto, nullable: true })
  currentMeasurement!: BodyMeasurementResponseDto | null;

  @ApiProperty({ type: [BodyMeasurementResponseDto] })
  measurements!: BodyMeasurementResponseDto[];

  @ApiPropertyOptional({ type: NutritionMetricsResponseDto, nullable: true })
  nutrition!: NutritionMetricsResponseDto | null;
}
