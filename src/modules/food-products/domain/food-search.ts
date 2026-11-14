import type { FoodRecord } from './food-catalog';

export function normalizeFoodSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizeFoodSearchQuery(value: string): string {
  return normalizeFoodSearchText(value)
    .split(' ')
    .map((word) => {
      if (word === 'paes') return 'pao';
      if (word === 'feijoes') return 'feijao';
      if (
        word.length > 4 &&
        word.endsWith('s') &&
        !word.endsWith('is') &&
        !word.endsWith('us')
      ) {
        return word.slice(0, -1);
      }
      return word;
    })
    .join(' ');
}

function relevance(name: string, query: string): number {
  const normalizedName = normalizeFoodSearchText(name);
  const normalizedQuery = normalizeFoodSearchQuery(query);
  if (normalizedName === normalizedQuery) return 0;
  if (normalizedName.startsWith(normalizedQuery)) return 1;
  if (
    normalizedName.split(' ').some((word) => word.startsWith(normalizedQuery))
  ) {
    return 2;
  }
  if (normalizedName.includes(normalizedQuery)) return 3;
  return 4;
}

function deduplicationKey(food: FoodRecord): string {
  const barcode = food.barcode?.replace(/^0+/, '');
  if (barcode) return `barcode:${barcode}`;

  return [
    'food',
    normalizeFoodSearchText(food.name),
    food.caloriesPer100g,
    food.proteinPer100g,
    food.carbsPer100g,
    food.fatPer100g,
  ].join(':');
}

export function rankAndDeduplicateFoods(
  foods: readonly FoodRecord[],
  query: string,
  limit: number,
): FoodRecord[] {
  const unique = new Map<string, { food: FoodRecord; index: number }>();
  foods.forEach((food, index) => {
    const key = deduplicationKey(food);
    if (!unique.has(key)) unique.set(key, { food, index });
  });

  return [...unique.values()]
    .sort((left, right) => {
      const score =
        relevance(left.food.name, query) - relevance(right.food.name, query);
      if (score !== 0) return score;
      const name = left.food.name.localeCompare(right.food.name, 'pt-BR', {
        sensitivity: 'base',
      });
      return name !== 0 ? name : left.index - right.index;
    })
    .slice(0, limit)
    .map(({ food }) => food);
}
