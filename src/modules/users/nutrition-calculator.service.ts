import { BadRequestException, Injectable } from '@nestjs/common';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from './domain/profile.enums';

const ACTIVITY_FACTORS: Readonly<Record<ActivityLevel, number>> = {
  [ActivityLevel.SEDENTARY]: 1.2,
  [ActivityLevel.LIGHT]: 1.375,
  [ActivityLevel.MODERATE]: 1.55,
  [ActivityLevel.INTENSE]: 1.725,
  [ActivityLevel.VERY_INTENSE]: 1.9,
};

const KCAL_PER_KG = 7_700;
const DEFAULT_GOAL_ADJUSTMENT_RATE = 0.1;
const MAX_DAILY_DEFICIT_KCAL = 500;
const MAX_DAILY_SURPLUS_KCAL = 300;

export type NutritionCalculationInput = {
  dateOfBirth: string;
  biologicalSex: BiologicalSex;
  heightCm: number;
  currentWeightKg: number;
  goal: NutritionGoal;
  activityLevel: ActivityLevel;
  targetWeightKg?: number | null;
  targetDate?: string | null;
  today?: Date;
};

export type NutritionCalculation = {
  ageYears: number;
  bmrKcalPerDay: number;
  tdeeKcalPerDay: number;
  calorieTargetKcalPerDay: number;
};

@Injectable()
export class NutritionCalculatorService {
  calculateAge(dateOfBirth: string, today = new Date()): number {
    const birthDate = this.parseDateOnly(dateOfBirth, 'dateOfBirth');
    const currentDate = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );

    let age = currentDate.getUTCFullYear() - birthDate.getUTCFullYear();
    const birthdayHasOccurred =
      currentDate.getUTCMonth() > birthDate.getUTCMonth() ||
      (currentDate.getUTCMonth() === birthDate.getUTCMonth() &&
        currentDate.getUTCDate() >= birthDate.getUTCDate());

    if (!birthdayHasOccurred) {
      age -= 1;
    }

    if (age < 18 || age > 120) {
      throw new BadRequestException(
        'dateOfBirth must represent an age between 18 and 120 years',
      );
    }

    return age;
  }

  calculateBmr(input: {
    biologicalSex: BiologicalSex;
    weightKg: number;
    heightCm: number;
    ageYears: number;
  }): number {
    const sexAdjustment =
      input.biologicalSex === BiologicalSex.MALE ? 5 : -161;
    const bmr =
      10 * input.weightKg +
      6.25 * input.heightCm -
      5 * input.ageYears +
      sexAdjustment;

    return Math.round(bmr);
  }

  calculateTdee(bmrKcalPerDay: number, activityLevel: ActivityLevel): number {
    return Math.round(bmrKcalPerDay * ACTIVITY_FACTORS[activityLevel]);
  }

  calculateCalorieTarget(
    input: NutritionCalculationInput,
    bmrKcalPerDay: number,
    tdeeKcalPerDay: number,
  ): number {
    let adjustment = 0;

    if (input.goal === NutritionGoal.LOSE_WEIGHT) {
      adjustment = this.goalAdjustment(
        input,
        -tdeeKcalPerDay * DEFAULT_GOAL_ADJUSTMENT_RATE,
        -MAX_DAILY_DEFICIT_KCAL,
        0,
      );
    } else if (input.goal === NutritionGoal.GAIN_MUSCLE) {
      adjustment = this.goalAdjustment(
        input,
        tdeeKcalPerDay * DEFAULT_GOAL_ADJUSTMENT_RATE,
        0,
        MAX_DAILY_SURPLUS_KCAL,
      );
    }

    return Math.round(
      Math.max(
        bmrKcalPerDay,
        Math.min(
          tdeeKcalPerDay + MAX_DAILY_SURPLUS_KCAL,
          tdeeKcalPerDay + adjustment,
        ),
      ),
    );
  }

  calculate(input: NutritionCalculationInput): NutritionCalculation {
    const today = input.today ?? new Date();
    if (input.targetDate) {
      this.daysUntil(input.targetDate, today);
    }
    const ageYears = this.calculateAge(input.dateOfBirth, today);
    const bmrKcalPerDay = this.calculateBmr({
      biologicalSex: input.biologicalSex,
      weightKg: input.currentWeightKg,
      heightCm: input.heightCm,
      ageYears,
    });
    const tdeeKcalPerDay = this.calculateTdee(
      bmrKcalPerDay,
      input.activityLevel,
    );

    return {
      ageYears,
      bmrKcalPerDay,
      tdeeKcalPerDay,
      calorieTargetKcalPerDay: this.calculateCalorieTarget(
        input,
        bmrKcalPerDay,
        tdeeKcalPerDay,
      ),
    };
  }

  private goalAdjustment(
    input: NutritionCalculationInput,
    fallback: number,
    minimum: number,
    maximum: number,
  ): number {
    if (input.targetWeightKg === null || input.targetWeightKg === undefined) {
      return this.clamp(fallback, minimum, maximum);
    }

    if (!input.targetDate) {
      return this.clamp(fallback, minimum, maximum);
    }

    const today = input.today ?? new Date();
    const days = this.daysUntil(input.targetDate, today);

    const dailyAdjustment =
      ((input.targetWeightKg - input.currentWeightKg) * KCAL_PER_KG) / days;

    const directionMatchesGoal =
      (input.goal === NutritionGoal.LOSE_WEIGHT && dailyAdjustment < 0) ||
      (input.goal === NutritionGoal.GAIN_MUSCLE && dailyAdjustment > 0);

    return this.clamp(
      directionMatchesGoal ? dailyAdjustment : fallback,
      minimum,
      maximum,
    );
  }

  private parseDateOnly(value: string, field: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

    if (!match) {
      throw new BadRequestException(`${field} must use YYYY-MM-DD format`);
    }

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));

    if (
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      throw new BadRequestException(`${field} must be a valid date`);
    }

    return date;
  }

  private daysUntil(targetDateValue: string, today: Date): number {
    const targetDate = this.parseDateOnly(targetDateValue, 'targetDate');
    const todayUtc = Date.UTC(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      today.getUTCDate(),
    );
    const days = Math.ceil((targetDate.getTime() - todayUtc) / 86_400_000);

    if (days <= 0) {
      throw new BadRequestException('targetDate must be in the future');
    }

    return days;
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
