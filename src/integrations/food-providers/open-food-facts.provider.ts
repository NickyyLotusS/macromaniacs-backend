import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodSource } from '../database/entities/enums';
import type {
  FoodProvider,
  FoodSearchQuery,
  ProviderFood,
} from '../../modules/food-products/domain/food-provider';
import { FoodProviderResponseError } from './provider-errors';
import { ResilientFetchService } from './resilient-fetch.service';

type OffProduct = {
  code?: string;
  product_name?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};
type OffProductResponse = { status?: number; product?: OffProduct };
type OffSearchResponse = { products?: OffProduct[] };

@Injectable()
export class OpenFoodFactsProvider implements FoodProvider {
  readonly source = FoodSource.OPEN_FOOD_FACTS;

  constructor(
    private readonly config: ConfigService,
    private readonly http: ResilientFetchService,
  ) {}

  async findByBarcode(barcode: string): Promise<ProviderFood | null> {
    const url = new URL(
      `/api/v3/product/${encodeURIComponent(barcode)}.json`,
      this.baseUrl(),
    );
    url.searchParams.set(
      'fields',
      'code,product_name,serving_quantity,nutriments',
    );
    const body = await this.http.json<OffProductResponse>(
      'open-food-facts',
      url,
      this.headers(),
    );
    if (!body || body.status === 0 || !body.product) return null;
    return this.map(body.product, barcode);
  }

  async search(query: FoodSearchQuery): Promise<ProviderFood[]> {
    const url = new URL('/cgi/search.pl', this.baseUrl());
    url.searchParams.set('search_terms', query.query);
    url.searchParams.set('search_simple', '1');
    url.searchParams.set('action', 'process');
    url.searchParams.set('json', '1');
    url.searchParams.set('page', String(query.page));
    url.searchParams.set('page_size', String(query.limit));
    url.searchParams.set(
      'fields',
      'code,product_name,serving_quantity,nutriments',
    );
    const body = await this.http.json<OffSearchResponse>(
      'open-food-facts',
      url,
      this.headers(),
    );
    return (body?.products ?? [])
      .map((product) => {
        try {
          return this.map(product, product.code);
        } catch {
          return null;
        }
      })
      .filter((food): food is ProviderFood => food !== null);
  }

  private map(product: OffProduct, barcode?: string): ProviderFood {
    const name = product.product_name?.trim();
    const externalId = product.code?.trim() || barcode?.trim();
    if (!name || !externalId) {
      throw new FoodProviderResponseError(
        'open-food-facts',
        'product identity is incomplete',
      );
    }
    const nutrients = product.nutriments ?? {};
    return {
      externalId,
      name,
      barcode: barcode ?? product.code ?? null,
      basisGrams: '100',
      servingSizeGrams: this.optional(product.serving_quantity),
      nutrients: {
        caloriesKcal: this.required(nutrients['energy-kcal_100g'], 'energy'),
        proteinGrams: this.required(nutrients.proteins_100g, 'protein'),
        carbohydrateGrams: this.required(
          nutrients.carbohydrates_100g,
          'carbohydrate',
        ),
        fatGrams: this.required(nutrients.fat_100g, 'fat'),
        fiberGrams: this.optional(nutrients.fiber_100g),
      },
      retrievedAt: new Date(),
    };
  }

  private required(value: unknown, field: string): string {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) {
      throw new FoodProviderResponseError(
        'open-food-facts',
        `${field} is missing`,
      );
    }
    return String(number);
  }

  private optional(value: unknown): string | null {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? String(number) : null;
  }

  private baseUrl(): string {
    return (
      this.config.get<string>('OPEN_FOOD_FACTS_BASE_URL') ??
      'https://world.openfoodfacts.org'
    );
  }

  private headers(): Record<string, string> {
    return {
      'User-Agent':
        this.config.get<string>('OPEN_FOOD_FACTS_USER_AGENT') ??
        'MacroManiacs/0.0.1 (backend integration)',
    };
  }
}
