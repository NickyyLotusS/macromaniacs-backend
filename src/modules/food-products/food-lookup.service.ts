import {
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FoodSource } from '../../integrations/database/entities/enums';
import { FoodProviderUnavailableError } from '../../integrations/food-providers/provider-errors';
import { paginationMeta } from '../../shared/http/pagination.dto';
import {
  FOOD_CATALOG_REPOSITORY,
  type FoodCatalogRepository,
} from './domain/food-catalog';
import { FoodCacheService } from './food-cache.service';
import { FoodSearchCacheService } from './food-search-cache.service';
import { FOOD_PROVIDERS, type FoodProviders } from './food-provider.tokens';
import type { SearchFoodsQueryDto } from './dto/search-foods-query.dto';
import type { FoodSuggestionsQueryDto } from './dto/food-suggestions-query.dto';
import {
  FoodExternalSearchStatus,
  FoodListResponseDto,
  FoodResponseDto,
  FoodSuggestionsResponseDto,
} from './dto/food-response.dto';
import type { FoodRecord } from './domain/food-catalog';
import { rankAndDeduplicateFoods } from './domain/food-search';
import { FoodNormalizationError } from './domain/nutrition-normalizer';

type ExternalSearchResult = {
  records: FoodRecord[];
  successfulProviders: number;
  fullProviderPage: boolean;
};

@Injectable()
export class FoodLookupService {
  constructor(
    @Inject(FOOD_CATALOG_REPOSITORY)
    private readonly repository: FoodCatalogRepository,
    @Inject(FOOD_PROVIDERS)
    private readonly providers: FoodProviders,
    private readonly cache: FoodCacheService,
    private readonly searchCache: FoodSearchCacheService,
    private readonly config: ConfigService,
  ) {}

  async search(query: SearchFoodsQueryDto): Promise<FoodListResponseDto> {
    const localPromise = this.repository.search(
      query.q,
      query.page,
      query.limit,
    );
    if (!query.external) {
      const local = await localPromise;
      return {
        items: local.items.map(FoodResponseDto.from),
        meta: paginationMeta(local.total, query),
      };
    }

    const [local, external] = await Promise.all([
      localPromise,
      this.searchExternal(query.q, query.page, query.limit),
    ]);
    if (!external.successfulProviders && local.items.length === 0) {
      throw new ServiceUnavailableException(
        'Food providers are temporarily unavailable',
      );
    }

    const items = rankAndDeduplicateFoods(
      [...local.items, ...external.records],
      query.q,
      query.limit,
    );
    const pageFloor = (query.page - 1) * query.limit + items.length;
    const total = Math.max(
      local.total,
      pageFloor + (external.fullProviderPage ? 1 : 0),
    );
    return {
      items: items.map(FoodResponseDto.from),
      meta: paginationMeta(total, query),
    };
  }

  async suggestions(
    query: FoodSuggestionsQueryDto,
  ): Promise<FoodSuggestionsResponseDto> {
    const candidateLimit = Math.max(query.limit * 2, 16);
    const [local, external] = await Promise.all([
      this.repository.search(query.q, 1, candidateLimit),
      this.searchExternal(query.q, 1, candidateLimit),
    ]);
    const items = rankAndDeduplicateFoods(
      [...local.items, ...external.records],
      query.q,
      query.limit,
    );

    return {
      items: items.map(FoodResponseDto.from),
      externalStatus: external.successfulProviders
        ? FoodExternalSearchStatus.AVAILABLE
        : FoodExternalSearchStatus.UNAVAILABLE,
    };
  }

  async byBarcode(value: string): Promise<FoodResponseDto> {
    const barcode = value.trim();
    const cached = await this.repository.findByBarcode(barcode);
    if (cached) return FoodResponseDto.from(cached);

    let successfulProvider = false;
    for (const provider of this.enabledProviders()) {
      try {
        const result = await this.cache.findByBarcode(barcode, provider);
        successfulProvider = true;
        if (result) return FoodResponseDto.from(result.food);
      } catch (error) {
        if (!(error instanceof FoodProviderUnavailableError)) throw error;
      }
    }
    if (!successfulProvider) {
      throw new ServiceUnavailableException(
        'Food providers are temporarily unavailable',
      );
    }
    throw new NotFoundException('Food not found');
  }

  async get(id: string): Promise<FoodResponseDto> {
    const food = await this.repository.findById(id);
    if (!food) throw new NotFoundException('Food not found');
    return FoodResponseDto.from(food);
  }

  private async searchExternal(
    query: string,
    page: number,
    limit: number,
  ): Promise<ExternalSearchResult> {
    const results = await Promise.all(
      this.enabledProviders().map(async (provider) => {
        try {
          const { foods } = await this.searchCache.search(
            provider,
            query,
            page,
            limit,
          );
          const records = (
            await Promise.all(
              foods.map(async (food) => {
                try {
                  return await this.cache.cacheProviderFood(provider, food);
                } catch (error) {
                  if (error instanceof FoodNormalizationError) return null;
                  throw error;
                }
              }),
            )
          ).filter((record): record is FoodRecord => record !== null);
          return {
            records,
            successful: true,
            fullPage: foods.length >= limit,
          };
        } catch (error) {
          if (!(error instanceof FoodProviderUnavailableError)) throw error;
          return { records: [], successful: false, fullPage: false };
        }
      }),
    );

    return {
      records: results.flatMap(({ records }) => records),
      successfulProviders: results.filter(({ successful }) => successful)
        .length,
      fullProviderPage: results.some(({ fullPage }) => fullPage),
    };
  }

  private enabledProviders(): FoodProviders {
    return this.providers.filter((provider) => {
      if (provider.source === FoodSource.OPEN_FOOD_FACTS) {
        return this.enabled('OPEN_FOOD_FACTS_ENABLED', true);
      }
      if (provider.source === FoodSource.USDA) {
        return Boolean(this.config.get<string>('USDA_API_KEY')?.trim());
      }
      return false;
    });
  }

  private enabled(name: string, fallback: boolean): boolean {
    const value = this.config.get<string | boolean>(name);
    if (value === undefined) return fallback;
    return value === true || value === 'true';
  }
}
