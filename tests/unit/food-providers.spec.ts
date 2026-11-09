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
    );
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
});
