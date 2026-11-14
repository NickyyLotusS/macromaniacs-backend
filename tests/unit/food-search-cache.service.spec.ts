import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { FoodSource } from '../../src/integrations/database/entities/enums';
import type {
  FoodProvider,
  ProviderFood,
} from '../../src/modules/food-products/domain/food-provider';
import { FoodSearchCacheService } from '../../src/modules/food-products/food-search-cache.service';

const food = (externalId: string): ProviderFood => ({
  externalId,
  name: 'Pão integral',
  barcode: externalId,
  basisGrams: '100',
  nutrients: {
    caloriesKcal: '250',
    proteinGrams: '10',
    carbohydrateGrams: '45',
    fatGrams: '4',
  },
  retrievedAt: new Date('2026-11-14T12:00:00.000Z'),
});

describe('FoodSearchCacheService', () => {
  const config = {
    get: (key: string) =>
      key === 'FOOD_SEARCH_CACHE_TTL_MS' ? 1000 : undefined,
  } as ConfigService;

  it('reuses accent-equivalent terms until the TTL expires', async () => {
    let now = 1000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    const provider: jest.Mocked<FoodProvider> = {
      source: FoodSource.OPEN_FOOD_FACTS,
      search: jest
        .fn<FoodProvider['search']>()
        .mockResolvedValueOnce([food('1')])
        .mockResolvedValueOnce([food('2')]),
      findByBarcode: jest.fn(),
    };
    const service = new FoodSearchCacheService(config);

    await expect(service.search(provider, 'pão', 1, 8)).resolves.toMatchObject({
      cacheHit: false,
      foods: [{ externalId: '1' }],
    });
    await expect(service.search(provider, 'PAO', 1, 8)).resolves.toMatchObject({
      cacheHit: true,
      foods: [{ externalId: '1' }],
    });

    now = 2001;
    await expect(service.search(provider, 'pao', 1, 8)).resolves.toMatchObject({
      cacheHit: false,
      foods: [{ externalId: '2' }],
    });
    expect(provider.search).toHaveBeenCalledTimes(2);
  });

  it('coalesces simultaneous equivalent requests', async () => {
    let resolve!: (foods: ProviderFood[]) => void;
    const pending = new Promise<ProviderFood[]>((done) => {
      resolve = done;
    });
    const provider: jest.Mocked<FoodProvider> = {
      source: FoodSource.OPEN_FOOD_FACTS,
      search: jest.fn<FoodProvider['search']>().mockReturnValue(pending),
      findByBarcode: jest.fn(),
    };
    const service = new FoodSearchCacheService(config);

    const first = service.search(provider, 'sorvete', 1, 8);
    const second = service.search(provider, 'SORVETE', 1, 8);
    resolve([food('3')]);

    await expect(first).resolves.toMatchObject({
      foods: [{ externalId: '3' }],
    });
    await expect(second).resolves.toMatchObject({
      cacheHit: true,
      foods: [{ externalId: '3' }],
    });
    expect(provider.search).toHaveBeenCalledTimes(1);
  });
});
