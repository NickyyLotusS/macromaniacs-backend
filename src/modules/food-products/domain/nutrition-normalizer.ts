import { Injectable } from '@nestjs/common';
import type {
  FoodProviderSource,
  NormalizedFood,
  ProviderFood,
} from './food-provider';

type ParsedDecimal = { coefficient: bigint; scale: number };

export class FoodNormalizationError extends Error {
  constructor(
    readonly field: string,
    reason: string,
  ) {
    super(`Invalid ${field}: ${reason}`);
    this.name = 'FoodNormalizationError';
  }
}

@Injectable()
export class NutritionNormalizer {
  normalize(source: FoodProviderSource, food: ProviderFood): NormalizedFood {
    const name = food.name.trim();
    const externalId = food.externalId.trim();

    if (!name) throw new FoodNormalizationError('name', 'must not be blank');
    if (!externalId) {
      throw new FoodNormalizationError('externalId', 'must not be blank');
    }
    if (
      !(food.retrievedAt instanceof Date) ||
      Number.isNaN(food.retrievedAt.getTime())
    ) {
      throw new FoodNormalizationError('retrievedAt', 'must be a valid date');
    }

    const basis = this.parseDecimal(food.basisGrams, 'basisGrams');
    if (basis.coefficient <= 0n) {
      throw new FoodNormalizationError(
        'basisGrams',
        'must be greater than zero',
      );
    }

    return {
      name,
      source,
      externalId,
      barcode: this.optionalText(food.barcode),
      caloriesPer100g: this.per100g(
        food.nutrients.caloriesKcal,
        'caloriesKcal',
        basis,
      ),
      proteinPer100g: this.per100g(
        food.nutrients.proteinGrams,
        'proteinGrams',
        basis,
      ),
      carbsPer100g: this.per100g(
        food.nutrients.carbohydrateGrams,
        'carbohydrateGrams',
        basis,
      ),
      fatPer100g: this.per100g(food.nutrients.fatGrams, 'fatGrams', basis),
      fiberPer100g: this.per100g(
        food.nutrients.fiberGrams ?? '0',
        'fiberGrams',
        basis,
      ),
      servingSizeG: this.toFixed2(
        this.parsePositiveDecimal(
          food.servingSizeGrams ?? food.basisGrams,
          'servingSizeGrams',
        ),
      ),
      retrievedAt: new Date(food.retrievedAt),
    };
  }

  private per100g(value: string, field: string, basis: ParsedDecimal): string {
    const nutrient = this.parseDecimal(value, field);
    if (nutrient.coefficient < 0n) {
      throw new FoodNormalizationError(field, 'must not be negative');
    }

    const numerator =
      nutrient.coefficient * 10_000n * this.powerOfTen(basis.scale);
    const denominator = basis.coefficient * this.powerOfTen(nutrient.scale);
    return this.formatCents(this.roundDivide(numerator, denominator));
  }

  private parsePositiveDecimal(value: string, field: string): ParsedDecimal {
    const parsed = this.parseDecimal(value, field);
    if (parsed.coefficient <= 0n) {
      throw new FoodNormalizationError(field, 'must be greater than zero');
    }
    return parsed;
  }

  private parseDecimal(value: string, field: string): ParsedDecimal {
    if (typeof value !== 'string') {
      throw new FoodNormalizationError(field, 'must be a decimal string');
    }
    const normalized = value.trim();
    const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
    if (!match) {
      throw new FoodNormalizationError(field, 'must be a non-negative decimal');
    }
    const fraction = match[2] ?? '';
    return {
      coefficient: BigInt(`${match[1]}${fraction}`),
      scale: fraction.length,
    };
  }

  private toFixed2(value: ParsedDecimal): string {
    const numerator = value.coefficient * 100n;
    const denominator = this.powerOfTen(value.scale);
    return this.formatCents(this.roundDivide(numerator, denominator));
  }

  private roundDivide(numerator: bigint, denominator: bigint): bigint {
    return (numerator + denominator / 2n) / denominator;
  }

  private formatCents(cents: bigint): string {
    const whole = cents / 100n;
    const fraction = (cents % 100n).toString().padStart(2, '0');
    return `${whole}.${fraction}`;
  }

  private powerOfTen(scale: number): bigint {
    return 10n ** BigInt(scale);
  }

  private optionalText(value: string | null | undefined): string | null {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  }
}
