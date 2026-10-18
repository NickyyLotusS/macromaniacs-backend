import { BadRequestException, ConflictException } from '@nestjs/common';
import { jest } from '@jest/globals';
import { FoodSource } from '../../src/integrations/database/entities/enums';
import { DuplicateFoodBarcodeError } from '../../src/modules/food-products/domain/food-catalog';
import type {
  FoodCatalogRepository,
  FoodRecord,
} from '../../src/modules/food-products/domain/food-catalog';
import type {
  FoodProvider,
  ProviderFood,
} from '../../src/modules/food-products/domain/food-provider';
import { NutritionNormalizer } from '../../src/modules/food-products/domain/nutrition-normalizer';
import { FoodCacheService } from '../../src/modules/food-products/food-cache.service';

describe('FoodCacheService', () => {
  const record = (overrides: Partial<FoodRecord> = {}): FoodRecord => ({
    id: '10000000-0000-4000-8000-000000000001',
    name: 'Aveia',
    source: FoodSource.OPEN_FOOD_FACTS,
    externalId: 'off-123',
    barcode: '7891234567890',
    caloriesPer100g: '380.00',
    proteinPer100g: '13.30',
    carbsPer100g: '67.70',
    fatPer100g: '6.70',
    fiberPer100g: '10.60',
    servingSizeG: '30.00',
    createdAt: new Date('2026-10-18T10:00:00.000Z'),
    updatedAt: new Date('2026-10-18T10:00:00.000Z'),
    ...overrides,
  });

  const providerFood = (): ProviderFood => ({
    externalId: 'off-123',
    name: 'Aveia',
    barcode: '7891234567890',
    basisGrams: '30',
    servingSizeGrams: '30',
    nutrients: {
      caloriesKcal: '114',
      proteinGrams: '3.99',
      carbohydrateGrams: '20.31',
      fatGrams: '2.01',
      fiberGrams: '3.18',
    },
    retrievedAt: new Date('2026-10-18T10:00:00.000Z'),
  });

  const repository = (): jest.Mocked<FoodCatalogRepository> => ({
    findByBarcode: jest.fn(),
    findByExternalIdentity: jest.fn(),
    saveExternal: jest.fn(),
    createManual: jest.fn(),
  });

  const provider = (): jest.Mocked<FoodProvider> => ({
    source: FoodSource.OPEN_FOOD_FACTS,
    search: jest.fn(),
    findByBarcode: jest.fn(),
  });

  it('retorna o registro local sem chamar o provedor', async () => {
    const foods = repository();
    const external = provider();
    foods.findByBarcode.mockResolvedValue(record());
    const service = new FoodCacheService(foods, new NutritionNormalizer());

    const result = await service.findByBarcode('7891234567890', external);

    expect(result).toMatchObject({ cacheHit: true, food: { id: record().id } });
    expect(external.findByBarcode).not.toHaveBeenCalled();
    expect(foods.saveExternal).not.toHaveBeenCalled();
  });

  it('normaliza e persiste apenas o primeiro resultado externo', async () => {
    const foods = repository();
    const external = provider();
    let cached: FoodRecord | null = null;
    foods.findByBarcode.mockImplementation(async () => cached);
    foods.saveExternal.mockImplementation(async (input) => {
      cached = record(input);
      return cached;
    });
    external.findByBarcode.mockResolvedValue(providerFood());
    const service = new FoodCacheService(foods, new NutritionNormalizer());

    await expect(
      service.findByBarcode('7891234567890', external),
    ).resolves.toMatchObject({
      cacheHit: false,
      food: { caloriesPer100g: '380.00' },
    });
    await expect(
      service.findByBarcode('7891234567890', external),
    ).resolves.toMatchObject({ cacheHit: true });

    expect(external.findByBarcode).toHaveBeenCalledTimes(1);
    expect(foods.saveExternal).toHaveBeenCalledTimes(1);
  });

  it('mantém não encontrado como resultado controlado', async () => {
    const foods = repository();
    const external = provider();
    foods.findByBarcode.mockResolvedValue(null);
    external.findByBarcode.mockResolvedValue(null);
    const service = new FoodCacheService(foods, new NutritionNormalizer());

    await expect(
      service.findByBarcode('7891234567890', external),
    ).resolves.toBeNull();
  });

  it('rejeita barcode inválido antes de consultar banco ou provedor', async () => {
    const foods = repository();
    const external = provider();
    const service = new FoodCacheService(foods, new NutritionNormalizer());

    await expect(service.findByBarcode('abc', external)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(foods.findByBarcode).not.toHaveBeenCalled();
    expect(external.findByBarcode).not.toHaveBeenCalled();
  });

  it('traduz colisão de barcode manual para conflito HTTP', async () => {
    const foods = repository();
    foods.createManual.mockRejectedValue(
      new DuplicateFoodBarcodeError('7891234567890'),
    );
    const service = new FoodCacheService(foods, new NutritionNormalizer());

    await expect(
      service.createManual({
        name: 'Aveia',
        barcode: '7891234567890',
        caloriesPer100g: 380,
        proteinPer100g: 13.3,
        carbsPer100g: 67.7,
        fatPer100g: 6.7,
        fiberPer100g: 10.6,
        servingSizeG: 30,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
