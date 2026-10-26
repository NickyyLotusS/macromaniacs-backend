import { BadRequestException } from '@nestjs/common';
import { FoodSource } from '../../src/integrations/database/entities/enums';
import { Food } from '../../src/integrations/database/entities/nutrition/food.entity';
import { PlannedNutritionCalculator } from '../../src/modules/diet-plans/planned-nutrition.calculator';

describe('PlannedNutritionCalculator', () => {
  const calculator = new PlannedNutritionCalculator();
  const food = Object.assign(new Food(), {
    caloriesPer100g: '389.00',
    proteinPer100g: '16.90',
    carbsPer100g: '66.30',
    fatPer100g: '6.90',
    fiberPer100g: '10.60',
    source: FoodSource.MANUAL,
  });

  it('calcula e arredonda snapshots em centésimos sem ponto flutuante', () => {
    expect(calculator.calculate(food, 120.5)).toEqual({
      calories: '468.75',
      protein: '20.36',
      carbs: '79.89',
      fat: '8.31',
      fiber: '12.77',
    });
  });

  it('soma snapshots preservando os centésimos', () => {
    expect(calculator.sum(['0.10', '0.20', '1.15'])).toBe(1.45);
  });

  it('rejeita snapshot que excederia a capacidade da coluna', () => {
    const extreme = Object.assign(new Food(), food, {
      proteinPer100g: '9999.99',
    });
    expect(() => calculator.calculate(extreme, 9999.99)).toThrow(
      BadRequestException,
    );
  });
});
