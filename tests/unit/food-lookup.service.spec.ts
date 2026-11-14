import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { FoodSource } from '../../src/integrations/database/entities/enums';
import { FoodProviderUnavailableError } from '../../src/integrations/food-providers/provider-errors';
import type {
  FoodCatalogRepository,
  FoodRecord,
} from '../../src/modules/food-products/domain/food-catalog';
import type {
  FoodProvider,
  ProviderFood,
} from '../../src/modules/food-products/domain/food-provider';
import { FoodNormalizationError } from '../../src/modules/food-products/domain/nutrition-normalizer';
import { FoodExternalSearchStatus } from '../../src/modules/food-products/dto/food-response.dto';
import { FoodCacheService } from '../../src/modules/food-products/food-cache.service';
import { FoodLookupService } from '../../src/modules/food-products/food-lookup.service';
import { FoodSearchCacheService } from '../../src/modules/food-products/food-search-cache.service';

const providerFood = (externalId = 'off-1'): ProviderFood => ({
  externalId,
  name: 'Sorvete de creme',
  barcode: `789${externalId}`,
  basisGrams: '100',
  nutrients: {
    caloriesKcal: '180',
    proteinGrams: '3',
    carbohydrateGrams: '25',
    fatGrams: '8',
  },
  retrievedAt: new Date('2026-11-14T12:00:00.000Z'),
});

const record = (overrides: Partial<FoodRecord> = {}): FoodRecord => ({
  id: '10000000-0000-4000-8000-000000000001',
  name: 'Sorvete de creme',
  source: FoodSource.OPEN_FOOD_FACTS,
  externalId: 'off-1',
  barcode: '789off-1',
  caloriesPer100g: '180.00',
  proteinPer100g: '3.00',
  carbsPer100g: '25.00',
  fatPer100g: '8.00',
  fiberPer100g: '0.00',
  servingSizeG: '100.00',
  retrievedAt: new Date('2026-11-14T12:00:00.000Z'),
  createdAt: new Date('2026-11-14T12:00:00.000Z'),
  updatedAt: new Date('2026-11-14T12:00:00.000Z'),
  ...overrides,
});

describe('FoodLookupService', () => {
  const setup = () => {
    const repository: jest.Mocked<FoodCatalogRepository> = {
      findByBarcode: jest.fn(),
      findById: jest.fn(),
      search: jest.fn(),
      findByExternalIdentity: jest.fn(),
      saveExternal: jest.fn(),
      createManual: jest.fn(),
    };
    const provider: jest.Mocked<FoodProvider> = {
      source: FoodSource.OPEN_FOOD_FACTS,
      search: jest.fn(),
      findByBarcode: jest.fn(),
    };
    const cache = {
      cacheProviderFood: jest.fn(),
    } as unknown as jest.Mocked<FoodCacheService>;
    const searchCache = {
      search: jest.fn(),
    } as unknown as jest.Mocked<FoodSearchCacheService>;
    const config = {
      get: (key: string) =>
        key === 'OPEN_FOOD_FACTS_ENABLED' ? true : undefined,
    } as ConfigService;
    const service = new FoodLookupService(
      repository,
      [provider],
      cache,
      searchCache,
      config,
    );
    return { cache, provider, repository, searchCache, service };
  };

  it('returns a suggestion that exists only in an external provider', async () => {
    const { cache, repository, searchCache, service } = setup();
    repository.search.mockResolvedValue({ items: [], total: 0 });
    searchCache.search.mockResolvedValue({
      foods: [providerFood()],
      cacheHit: false,
    });
    cache.cacheProviderFood.mockResolvedValue(record());

    await expect(
      service.suggestions({ q: 'sorv', limit: 8 }),
    ).resolves.toMatchObject({
      externalStatus: FoodExternalSearchStatus.AVAILABLE,
      items: [
        {
          name: 'Sorvete de creme',
          source: FoodSource.OPEN_FOOD_FACTS,
        },
      ],
    });
  });

  it('combines local and external results and deduplicates the same barcode', async () => {
    const { cache, repository, searchCache, service } = setup();
    const local = record({ id: 'local', source: FoodSource.MANUAL });
    const external = record({ id: 'external' });
    repository.search.mockResolvedValue({ items: [local], total: 1 });
    searchCache.search.mockResolvedValue({
      foods: [providerFood()],
      cacheHit: false,
    });
    cache.cacheProviderFood.mockResolvedValue(external);

    const result = await service.suggestions({ q: 'sorvete', limit: 8 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('local');
  });

  it('keeps local results and reports external unavailability', async () => {
    const { repository, searchCache, service } = setup();
    repository.search.mockResolvedValue({ items: [record()], total: 1 });
    searchCache.search.mockRejectedValue(
      new FoodProviderUnavailableError('open-food-facts', 'HTTP 429'),
    );

    await expect(
      service.suggestions({ q: 'sorvete', limit: 8 }),
    ).resolves.toMatchObject({
      externalStatus: FoodExternalSearchStatus.UNAVAILABLE,
      items: [{ name: 'Sorvete de creme' }],
    });
  });

  it('returns provider page results directly instead of losing page two', async () => {
    const { cache, repository, searchCache, service } = setup();
    repository.search.mockResolvedValue({ items: [], total: 0 });
    searchCache.search.mockResolvedValue({
      foods: [providerFood('page-2')],
      cacheHit: false,
    });
    cache.cacheProviderFood.mockResolvedValue(
      record({ id: 'page-2', externalId: 'page-2', barcode: null }),
    );

    await expect(
      service.search({ q: 'sorvete', page: 2, limit: 20, external: true }),
    ).resolves.toMatchObject({
      items: [{ id: 'page-2' }],
      meta: { page: 2, totalItems: 21, totalPages: 2 },
    });
  });

  it('drops external foods without mandatory nutrition instead of inventing it', async () => {
    const { cache, repository, searchCache, service } = setup();
    repository.search.mockResolvedValue({ items: [], total: 0 });
    searchCache.search.mockResolvedValue({
      foods: [providerFood()],
      cacheHit: false,
    });
    cache.cacheProviderFood.mockRejectedValue(
      new FoodNormalizationError('proteinGrams', 'must be present'),
    );

    await expect(
      service.suggestions({ q: 'sorvete', limit: 8 }),
    ).resolves.toEqual({
      externalStatus: FoodExternalSearchStatus.AVAILABLE,
      items: [],
    });
  });

  it('preserves the full-search 503 when no local or external source responds', async () => {
    const { repository, searchCache, service } = setup();
    repository.search.mockResolvedValue({ items: [], total: 0 });
    searchCache.search.mockRejectedValue(
      new FoodProviderUnavailableError('open-food-facts'),
    );

    await expect(
      service.search({ q: 'sorvete', page: 1, limit: 20, external: true }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
