import { ConfigService } from '@nestjs/config';
import { jest } from '@jest/globals';
import { OpenFoodFactsProvider } from '../../src/integrations/food-providers/open-food-facts.provider';
import { FoodProviderUnavailableError } from '../../src/integrations/food-providers/provider-errors';
import { ResilientFetchService } from '../../src/integrations/food-providers/resilient-fetch.service';
import { UsdaFoodDataProvider } from '../../src/integrations/food-providers/usda.provider';

const config = (values: Record<string, unknown> = {}) =>
  ({ get: (key: string) => values[key] }) as ConfigService;

describe('Food provider adapters', () => {
  it('maps an Open Food Facts barcode response to the canonical provider contract', async () => {
    const json = jest.fn<ResilientFetchService['json']>().mockResolvedValue({
      status: 1,
      product: {
        code: '7891234567890',
        product_name: 'Aveia',
        serving_quantity: 30,
        nutriments: {
          'energy-kcal_100g': 380,
          proteins_100g: 13.3,
          carbohydrates_100g: 67.7,
          fat_100g: 6.7,
          fiber_100g: 10.6,
        },
      },
    });
    const provider = new OpenFoodFactsProvider(config(), {
      json,
    } as unknown as ResilientFetchService);

    await expect(
      provider.findByBarcode('7891234567890'),
    ).resolves.toMatchObject({
      externalId: '7891234567890',
      name: 'Aveia',
      basisGrams: '100',
      nutrients: { caloriesKcal: '380', proteinGrams: '13.3' },
    });
    expect(json).toHaveBeenCalledWith(
      'open-food-facts',
      expect.objectContaining({
        pathname: '/api/v3/product/7891234567890.json',
      }),
      expect.objectContaining({
        'User-Agent': expect.stringContaining('MacroManiacs'),
      }),
      expect.objectContaining({
        rateLimit: expect.objectContaining({
          key: 'open-food-facts-product',
          maxRequests: 12,
        }),
      }),
    );
  });

  it('uses Search-a-licious in Portuguese and drops incomplete products', async () => {
    const json = jest.fn<ResilientFetchService['json']>().mockResolvedValue({
      hits: [
        {
          code: '7890000000001',
          product_name: 'Sorvete',
          brands: ['Marca brasileira'],
          nutriments: {
            'energy-kcal_100g': 180,
            proteins_100g: 3,
            carbohydrates_100g: 25,
            fat_100g: 8,
          },
        },
        {
          code: '7890000000002',
          product_name: 'Sem proteína',
          nutriments: { 'energy-kcal_100g': 100 },
        },
      ],
    });
    const provider = new OpenFoodFactsProvider(config(), {
      json,
    } as unknown as ResilientFetchService);

    await expect(
      provider.search({ query: 'sorvete', page: 1, limit: 8 }),
    ).resolves.toMatchObject([
      {
        externalId: '7890000000001',
        name: 'Sorvete (Marca brasileira)',
        nutrients: { caloriesKcal: '180', proteinGrams: '3' },
      },
    ]);
    const url = json.mock.calls[0][1];
    expect(url.origin).toBe('https://search.openfoodfacts.org');
    expect(url.pathname).toBe('/search');
    expect(url.searchParams.get('langs')).toBe('pt,en');
    expect(url.searchParams.get('boost_phrase')).toBe('true');
  });

  it('restores common Portuguese accents without issuing another request', async () => {
    const json = jest
      .fn<ResilientFetchService['json']>()
      .mockResolvedValue({ hits: [] });
    const provider = new OpenFoodFactsProvider(config(), {
      json,
    } as unknown as ResilientFetchService);

    await provider.search({ query: 'feijoes e paes', page: 1, limit: 8 });

    expect(json.mock.calls[0][1].searchParams.get('q')).toBe('feijão e pão');
    expect(json).toHaveBeenCalledTimes(1);
  });

  it('maps USDA nutrient identifiers and requires a configured API key', async () => {
    const json = jest.fn<ResilientFetchService['json']>().mockResolvedValue({
      foods: [
        {
          fdcId: 123,
          description: 'Oats',
          gtinUpc: '7891234567890',
          foodNutrients: [
            { nutrientNumber: '208', value: 380 },
            { nutrientNumber: '203', value: 13.3 },
            { nutrientNumber: '205', value: 67.7 },
            { nutrientNumber: '204', value: 6.7 },
            { nutrientNumber: '291', value: 10.6 },
          ],
        },
      ],
    });
    const provider = new UsdaFoodDataProvider(
      config({ USDA_API_KEY: 'fixture-key' }),
      { json } as unknown as ResilientFetchService,
    );
    await expect(
      provider.search({ query: 'oats', page: 1, limit: 10 }),
    ).resolves.toMatchObject([
      {
        externalId: '123',
        name: 'Oats',
        nutrients: { fiberGrams: '10.6' },
      },
    ]);

    const disabled = new UsdaFoodDataProvider(config(), {
      json,
    } as unknown as ResilientFetchService);
    await expect(
      disabled.search({ query: 'oats', page: 1, limit: 10 }),
    ).rejects.toBeInstanceOf(FoodProviderUnavailableError);
  });

  it('opens the circuit after the configured failure threshold', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('down'));
    globalThis.fetch = fetchMock;
    try {
      const service = new ResilientFetchService(
        config({
          FOOD_PROVIDER_RETRIES: 0,
          FOOD_PROVIDER_TIMEOUT_MS: 100,
          FOOD_PROVIDER_CIRCUIT_FAILURES: 1,
          FOOD_PROVIDER_CIRCUIT_RESET_MS: 60_000,
        }),
      );
      await expect(
        service.json('fixture', new URL('https://example.com/data')),
      ).rejects.toBeInstanceOf(FoodProviderUnavailableError);
      await expect(
        service.json('fixture', new URL('https://example.com/data')),
      ).rejects.toThrow('circuit is open');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('does not retry HTTP 429 and blocks the provider for Retry-After', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        status: 429,
        headers: { 'Retry-After': '60' },
      }),
    );
    globalThis.fetch = fetchMock;
    try {
      const service = new ResilientFetchService(
        config({
          FOOD_PROVIDER_RETRIES: 1,
          FOOD_PROVIDER_TIMEOUT_MS: 100,
        }),
      );
      const options = {
        rateLimit: { key: 'fixture-search', maxRequests: 8, windowMs: 60_000 },
      };
      await expect(
        service.json(
          'fixture',
          new URL('https://example.com/data'),
          {},
          options,
        ),
      ).rejects.toThrow('HTTP 429');
      await expect(
        service.json(
          'fixture',
          new URL('https://example.com/data'),
          {},
          options,
        ),
      ).rejects.toThrow('temporarily blocked');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });

  it('enforces the local provider quota before another network call', async () => {
    const original = globalThis.fetch;
    const fetchMock = jest
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock;
    try {
      const service = new ResilientFetchService(
        config({ FOOD_PROVIDER_RETRIES: 0, FOOD_PROVIDER_TIMEOUT_MS: 100 }),
      );
      const options = {
        rateLimit: { key: 'one-per-minute', maxRequests: 1, windowMs: 60_000 },
      };

      await expect(
        service.json(
          'fixture',
          new URL('https://example.com/data'),
          {},
          options,
        ),
      ).resolves.toEqual({});
      await expect(
        service.json(
          'fixture',
          new URL('https://example.com/data'),
          {},
          options,
        ),
      ).rejects.toThrow('local provider rate limit exceeded');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    } finally {
      globalThis.fetch = original;
    }
  });
});
