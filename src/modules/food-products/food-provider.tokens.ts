import type { FoodProvider } from './domain/food-provider';

export const FOOD_PROVIDERS = Symbol('FOOD_PROVIDERS');
export type FoodProviders = readonly FoodProvider[];
