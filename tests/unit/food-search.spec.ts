import { FoodSource } from '../../src/integrations/database/entities/enums';
import type { FoodRecord } from '../../src/modules/food-products/domain/food-catalog';
import {
  normalizeFoodSearchText,
  normalizeFoodSearchQuery,
  rankAndDeduplicateFoods,
} from '../../src/modules/food-products/domain/food-search';

const food = (
  id: string,
  name: string,
  barcode: string | null,
): FoodRecord => ({
  id,
  name,
  source: FoodSource.MANUAL,
  externalId: null,
  barcode,
  caloriesPer100g: '100.00',
  proteinPer100g: '1.00',
  carbsPer100g: '20.00',
  fatPer100g: '1.00',
  fiberPer100g: '1.00',
  servingSizeG: '100.00',
  retrievedAt: null,
  createdAt: new Date('2026-11-14T12:00:00.000Z'),
  updatedAt: new Date('2026-11-14T12:00:00.000Z'),
});

describe('food search relevance', () => {
  it('normalizes case, accents and repeated spaces', () => {
    expect(normalizeFoodSearchText('  PÃO   de Açúcar ')).toBe('pao de acucar');
  });

  it('treats common singular and plural queries as equivalent', () => {
    expect(normalizeFoodSearchQuery('sorvetes')).toBe('sorvete');
    expect(normalizeFoodSearchQuery('feijões')).toBe('feijao');
    expect(normalizeFoodSearchQuery('pães')).toBe('pao');
  });

  it('prioritizes exact, prefix, word prefix and partial matches', () => {
    const ranked = rankAndDeduplicateFoods(
      [
        food('4', 'Creme de sorvete', null),
        food('3', 'Supersorvete gelado', null),
        food('2', 'Sorvete de creme', null),
        food('1', 'Sorvete', null),
      ],
      'sorvete',
      8,
    );
    expect(ranked.map(({ id }) => id)).toEqual(['1', '2', '4', '3']);
  });

  it('deduplicates the same barcode across sources', () => {
    expect(
      rankAndDeduplicateFoods(
        [food('local', 'Feijão', '0789'), food('external', 'Feijao', '789')],
        'feijao',
        8,
      ).map(({ id }) => id),
    ).toEqual(['local']);
  });
});
