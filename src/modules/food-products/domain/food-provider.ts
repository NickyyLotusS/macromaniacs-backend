import { FoodSource } from '../../../integrations/database/entities/enums';

export type FoodProviderSource = Exclude<FoodSource, FoodSource.MANUAL>;

export type FoodSearchQuery = {
  query: string;
  page: number;
  limit: number;
};

export type ProviderNutrients = {
  caloriesKcal: string;
  proteinGrams: string;
  carbohydrateGrams: string;
  fatGrams: string;
  fiberGrams?: string | null;
};

export type ProviderFood = {
  externalId: string;
  name: string;
  barcode?: string | null;
  basisGrams: string;
  servingSizeGrams?: string | null;
  nutrients: ProviderNutrients;
  retrievedAt: Date;
};

export type NormalizedFood = {
  name: string;
  source: FoodProviderSource;
  externalId: string;
  barcode: string | null;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  fiberPer100g: string;
  servingSizeG: string;
  retrievedAt: Date;
};

export interface FoodProvider {
  readonly source: FoodProviderSource;
  search(query: FoodSearchQuery): Promise<ProviderFood[]>;
  findByBarcode(barcode: string): Promise<ProviderFood | null>;
}
