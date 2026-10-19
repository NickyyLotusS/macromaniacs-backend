import { BadRequestException, Injectable } from '@nestjs/common';
import type { Food } from '../../integrations/database/entities/nutrition/food.entity';

export type NutritionSnapshot = {
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
  fiber: string;
};

const HUNDRED = 100n;
const PRODUCT_DIVISOR = 10_000n;
const MAX_CALORIES_CENTS = 99_999_999n;
const MAX_MACRO_CENTS = 999_999n;

@Injectable()
export class PlannedNutritionCalculator {
  calculate(food: Food, amountGrams: number): NutritionSnapshot {
    const amount = this.toHundredths(amountGrams.toFixed(2));
    const calories = this.scaled(food.caloriesPer100g, amount);
    const protein = this.scaled(food.proteinPer100g, amount);
    const carbs = this.scaled(food.carbsPer100g, amount);
    const fat = this.scaled(food.fatPer100g, amount);
    const fiber = this.scaled(food.fiberPer100g, amount);

    if (calories > MAX_CALORIES_CENTS) {
      throw new BadRequestException('Calculated calories exceed item capacity');
    }
    if ([protein, carbs, fat, fiber].some((value) => value > MAX_MACRO_CENTS)) {
      throw new BadRequestException('Calculated macros exceed item capacity');
    }

    return {
      calories: this.format(calories),
      protein: this.format(protein),
      carbs: this.format(carbs),
      fat: this.format(fat),
      fiber: this.format(fiber),
    };
  }

  sum(values: readonly string[]): number {
    return Number(
      this.format(
        values.reduce((sum, value) => sum + this.toHundredths(value), 0n),
      ),
    );
  }

  private scaled(valuePer100g: string, amountHundredths: bigint): bigint {
    const product = this.toHundredths(valuePer100g) * amountHundredths;
    return (product + PRODUCT_DIVISOR / 2n) / PRODUCT_DIVISOR;
  }

  private toHundredths(value: string): bigint {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
    if (!match) throw new BadRequestException('Invalid nutritional decimal');
    return BigInt(match[1]) * HUNDRED + BigInt((match[2] ?? '').padEnd(2, '0'));
  }

  private format(value: bigint): string {
    return `${value / HUNDRED}.${(value % HUNDRED).toString().padStart(2, '0')}`;
  }
}
