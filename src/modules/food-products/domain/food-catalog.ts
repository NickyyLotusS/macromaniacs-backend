import { FoodSource } from '../../../integrations/database/entities/enums';
import type { FoodProviderSource, NormalizedFood } from './food-provider';

export const FOOD_CATALOG_REPOSITORY = Symbol('FOOD_CATALOG_REPOSITORY');

export type FoodRecord = {
  id: string;
  name: string;
  source: FoodSource;
  externalId: string | null;
  barcode: string | null;
  caloriesPer100g: string;
  proteinPer100g: string;
  carbsPer100g: string;
  fatPer100g: string;
  fiberPer100g: string;
  servingSizeG: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ManualFood = Omit<
  FoodRecord,
  'id' | 'source' | 'externalId' | 'createdAt' | 'updatedAt'
>;

export interface FoodCatalogRepository {
  findByBarcode(barcode: string): Promise<FoodRecord | null>;
  findByExternalIdentity(
    source: FoodProviderSource,
    externalId: string,
  ): Promise<FoodRecord | null>;
  saveExternal(food: NormalizedFood): Promise<FoodRecord>;
  createManual(food: ManualFood): Promise<FoodRecord>;
}

export class DuplicateFoodBarcodeError extends Error {
  constructor(readonly barcode: string) {
    super(`Food barcode already exists: ${barcode}`);
    this.name = 'DuplicateFoodBarcodeError';
  }
}
