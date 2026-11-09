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
import { FOOD_PROVIDERS, type FoodProviders } from './food-provider.tokens';
import type { SearchFoodsQueryDto } from './dto/search-foods-query.dto';
import { FoodListResponseDto, FoodResponseDto } from './dto/food-response.dto';

@Injectable()
export class FoodLookupService {
  constructor(
    @Inject(FOOD_CATALOG_REPOSITORY)
    private readonly repository: FoodCatalogRepository,
    @Inject(FOOD_PROVIDERS)
    private readonly providers: FoodProviders,
    private readonly cache: FoodCacheService,
    private readonly config: ConfigService,
  ) {}

  async search(query: SearchFoodsQueryDto): Promise<FoodListResponseDto> {
    let local = await this.repository.search(query.q, query.page, query.limit);
    if (query.external && local.items.length < query.limit) {
      let successfulProvider = false;
      for (const provider of this.enabledProviders()) {
        try {
          const foods = await provider.search({
            query: query.q,
            page: query.page,
            limit: query.limit,
          });
          successfulProvider = true;
          for (const food of foods) {
            await this.cache.cacheProviderFood(provider, food);
          }
        } catch (error) {
          if (!(error instanceof FoodProviderUnavailableError)) throw error;
        }
      }
      local = await this.repository.search(query.q, query.page, query.limit);
      if (!successfulProvider && local.items.length === 0) {
        throw new ServiceUnavailableException(
          'Food providers are temporarily unavailable',
        );
      }
    }
    return {
      items: local.items.map(FoodResponseDto.from),
      meta: paginationMeta(local.total, query),
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
