import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { FoodProvider, ProviderFood } from './domain/food-provider';
import { normalizeFoodSearchQuery } from './domain/food-search';

type CacheEntry = {
  expiresAt: number;
  foods: ProviderFood[];
};

export type CachedProviderSearch = {
  foods: ProviderFood[];
  cacheHit: boolean;
};

@Injectable()
export class FoodSearchCacheService {
  private readonly entries = new Map<string, CacheEntry>();
  private readonly inFlight = new Map<string, Promise<ProviderFood[]>>();

  constructor(private readonly config: ConfigService) {}

  async search(
    provider: FoodProvider,
    query: string,
    page: number,
    limit: number,
  ): Promise<CachedProviderSearch> {
    const key = [
      provider.source,
      normalizeFoodSearchQuery(query),
      page,
      limit,
    ].join(':');
    const now = Date.now();
    const cached = this.entries.get(key);
    if (cached && cached.expiresAt > now) {
      return { foods: cached.foods, cacheHit: true };
    }
    if (cached) this.entries.delete(key);

    const running = this.inFlight.get(key);
    if (running) return { foods: await running, cacheHit: true };

    const request = provider.search({ query, page, limit });
    this.inFlight.set(key, request);
    try {
      const foods = await request;
      this.entries.set(key, {
        foods,
        expiresAt:
          now +
          (this.config.get<number>('FOOD_SEARCH_CACHE_TTL_MS') ?? 15 * 60_000),
      });
      return { foods, cacheHit: false };
    } finally {
      if (this.inFlight.get(key) === request) this.inFlight.delete(key);
    }
  }
}
