import { BadRequestException } from '@nestjs/common';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from './domain/profile.enums';
import { NutritionCalculatorService } from './nutrition-calculator.service';

describe('NutritionCalculatorService', () => {
  const calculator = new NutritionCalculatorService();
  const today = new Date('2026-09-19T12:00:00.000Z');

  const baseInput = {
    dateOfBirth: '1996-09-19',
    biologicalSex: BiologicalSex.MALE,
    heightCm: 180,
    currentWeightKg: 80,
    goal: NutritionGoal.MAINTAIN,
    activityLevel: ActivityLevel.MODERATE,
    today,
  };

  it('calculates age correctly immediately before and on the birthday', () => {
    expect(calculator.calculateAge('2000-09-20', today)).toBe(25);
    expect(calculator.calculateAge('2000-09-19', today)).toBe(26);
  });

  it('rejects impossible dates and ages outside the adult range', () => {
    expect(() => calculator.calculateAge('2000-02-31', today)).toThrow(
      BadRequestException,
    );
    expect(() => calculator.calculateAge('2010-01-01', today)).toThrow(
      BadRequestException,
    );
  });

  it('calculates Mifflin-St Jeor BMR for male and female reference cases', () => {
    expect(
      calculator.calculateBmr({
        biologicalSex: BiologicalSex.MALE,
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
      }),
    ).toBe(1780);
    expect(
      calculator.calculateBmr({
        biologicalSex: BiologicalSex.FEMALE,
        weightKg: 80,
        heightCm: 180,
        ageYears: 30,
      }),
    ).toBe(1614);
  });

  it('calculates TDEE using the centralized activity factor', () => {
    expect(calculator.calculateTdee(1780, ActivityLevel.MODERATE)).toBe(2759);
  });

  it('uses a conservative deficit and never goes below BMR', () => {
    const result = calculator.calculate({
      ...baseInput,
      goal: NutritionGoal.LOSE_WEIGHT,
    });

    expect(result.calorieTargetKcalPerDay).toBe(2483);
    expect(result.calorieTargetKcalPerDay).toBeGreaterThanOrEqual(
      result.bmrKcalPerDay,
    );
  });

  it('uses target weight and date with a capped daily adjustment', () => {
    const result = calculator.calculate({
      ...baseInput,
      goal: NutritionGoal.LOSE_WEIGHT,
      targetWeightKg: 65,
      targetDate: '2026-10-19',
    });

    expect(result.calorieTargetKcalPerDay).toBe(result.tdeeKcalPerDay - 500);
  });

  it('rejects a past target date for every goal', () => {
    expect(() =>
      calculator.calculate({
        ...baseInput,
        goal: NutritionGoal.MAINTAIN,
        targetWeightKg: 80,
        targetDate: '2026-09-18',
      }),
    ).toThrow('targetDate must be in the future');
  });

  it('recalculates TDEE when activity changes', () => {
    const sedentary = calculator.calculate({
      ...baseInput,
      activityLevel: ActivityLevel.SEDENTARY,
    });
    const intense = calculator.calculate({
      ...baseInput,
      activityLevel: ActivityLevel.INTENSE,
    });

    expect(intense.tdeeKcalPerDay).toBeGreaterThan(sedentary.tdeeKcalPerDay);
  });

  it('recalculates BMR when weight changes', () => {
    const first = calculator.calculate(baseInput);
    const changed = calculator.calculate({ ...baseInput, currentWeightKg: 70 });

    expect(changed.bmrKcalPerDay).toBe(first.bmrKcalPerDay - 100);
  });
});
