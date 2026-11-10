import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodSource } from '../database/entities/enums';
import type {
  FoodProvider,
  FoodSearchQuery,
  ProviderFood,
} from '../../modules/food-products/domain/food-provider';
import { FoodProviderUnavailableError } from './provider-errors';
import { ResilientFetchService } from './resilient-fetch.service';

type UsdaNutrient = {
  nutrientName?: string;
  nutrientNumber?: string;
  unitName?: string;
  value?: number;
};
type UsdaFood = {
  fdcId?: number;
  description?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  foodNutrients?: UsdaNutrient[];
};
type UsdaSearchResponse = { foods?: UsdaFood[] };

@Injectable()
export class UsdaFoodDataProvider implements FoodProvider {
  readonly source = FoodSource.USDA;

  constructor(
    private readonly config: ConfigService,
    private readonly http: ResilientFetchService,
  ) {}

  async findByBarcode(barcode: string): Promise<ProviderFood | null> {
    const foods = await this.searchRequest(barcode, 1, 10);
    const match = foods.find(
      (food) => food.gtinUpc?.replace(/^0+/, '') === barcode.replace(/^0+/, ''),
    );
    return match ? this.map(match) : null;
  }

  async search(query: FoodSearchQuery): Promise<ProviderFood[]> {
    return (await this.searchRequest(query.query, query.page, query.limit))
      .map((food) => {
        try {
          return this.map(food);
        } catch {
          return null;
        }
      })
      .filter((food): food is ProviderFood => food !== null);
  }

  private async searchRequest(
    query: string,
    page: number,
    limit: number,
  ): Promise<UsdaFood[]> {
    const apiKey = this.config.get<string>('USDA_API_KEY')?.trim();
    if (!apiKey) {
      throw new FoodProviderUnavailableError(
        'usda',
        'USDA_API_KEY is not configured',
      );
    }
    const url = new URL(
      '/fdc/v1/foods/search',
      this.config.get<string>('USDA_BASE_URL') ?? 'https://api.nal.usda.gov',
    );
    url.searchParams.set('api_key', apiKey);
    url.searchParams.set('query', query);
    url.searchParams.set('pageNumber', String(page));
    url.searchParams.set('pageSize', String(limit));
    const body = await this.http.json<UsdaSearchResponse>('usda', url);
    return body?.foods ?? [];
  }

  private map(food: UsdaFood): ProviderFood {
    if (!food.fdcId || !food.description?.trim()) {
      throw new Error('USDA food identity is incomplete');
    }
    return {
      externalId: String(food.fdcId),
      name: food.description.trim(),
      barcode: food.gtinUpc?.trim() || null,
      basisGrams: '100',
      servingSizeGrams:
        food.servingSizeUnit?.toLowerCase() === 'g' && food.servingSize
          ? String(food.servingSize)
          : null,
      nutrients: {
        caloriesKcal: this.nutrient(food, ['208', 'Energy']),
        proteinGrams: this.nutrient(food, ['203', 'Protein']),
        carbohydrateGrams: this.nutrient(food, [
          '205',
          'Carbohydrate, by difference',
        ]),
        fatGrams: this.nutrient(food, ['204', 'Total lipid (fat)']),
        fiberGrams: this.optionalNutrient(food, [
          '291',
          'Fiber, total dietary',
        ]),
      },
      retrievedAt: new Date(),
    };
  }

  private nutrient(food: UsdaFood, identities: string[]): string {
    const value = this.optionalNutrient(food, identities);
    if (value === null)
      throw new Error(`USDA nutrient ${identities[0]} missing`);
    return value;
  }

  private optionalNutrient(
    food: UsdaFood,
    identities: string[],
  ): string | null {
    const nutrient = food.foodNutrients?.find(
      (entry) =>
        identities.includes(entry.nutrientNumber ?? '') ||
        identities.includes(entry.nutrientName ?? ''),
    );
    const value = Number(nutrient?.value);
    return Number.isFinite(value) && value >= 0 ? String(value) : null;
  }
}
