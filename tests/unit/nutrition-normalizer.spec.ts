import { FoodSource } from '../../src/integrations/database/entities/enums';
import type {
  FoodProvider,
  ProviderFood,
} from '../../src/modules/food-products/domain/food-provider';
import {
  FoodNormalizationError,
  NutritionNormalizer,
} from '../../src/modules/food-products/domain/nutrition-normalizer';

describe('NutritionNormalizer', () => {
  const normalizer = new NutritionNormalizer();
  const source = FoodSource.OPEN_FOOD_FACTS;
  const food = (overrides: Partial<ProviderFood> = {}): ProviderFood => ({
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
    retrievedAt: new Date('2026-10-18T12:00:00.000Z'),
    ...overrides,
  });

  it('normaliza macros para 100 g com arredondamento decimal explícito', () => {
    expect(normalizer.normalize(source, food())).toEqual({
      name: 'Aveia',
      source,
      externalId: 'off-123',
      barcode: '7891234567890',
      caloriesPer100g: '380.00',
      proteinPer100g: '13.30',
      carbsPer100g: '67.70',
      fatPer100g: '6.70',
      fiberPer100g: '10.60',
      servingSizeG: '30.00',
      retrievedAt: new Date('2026-10-18T12:00:00.000Z'),
    });
  });

  it('preserva a fonte e o identificador externo para auditoria', () => {
    const input = food({ externalId: 'fdc-456', barcode: '  ' });
    const normalized = normalizer.normalize(FoodSource.USDA, input);
    expect(normalized).toMatchObject({
      source: FoodSource.USDA,
      externalId: 'fdc-456',
      barcode: null,
    });
    expect(normalized.retrievedAt).not.toBe(input.retrievedAt);
  });

  it('usa zero quando fibra não é fornecida pelo provedor', () => {
    const input = food();
    input.nutrients.fiberGrams = null;
    expect(normalizer.normalize(source, input).fiberPer100g).toBe('0.00');
  });

  it('arredonda metade para cima sem converter decimais em float', () => {
    const input = food({
      basisGrams: '100',
      servingSizeGrams: '30.005',
      nutrients: {
        caloriesKcal: '0.005',
        proteinGrams: '0',
        carbohydrateGrams: '0',
        fatGrams: '0',
      },
    });

    const normalized = normalizer.normalize(source, input);

    expect(normalized.caloriesPer100g).toBe('0.01');
    expect(normalized.servingSizeG).toBe('30.01');
  });

  it.each([
    ['basisGrams', food({ basisGrams: '0' })],
    [
      'proteinGrams',
      food({ nutrients: { ...food().nutrients, proteinGrams: '-1' } }),
    ],
    ['name', food({ name: '  ' })],
    ['externalId', food({ externalId: '' })],
  ])('rejeita %s inválido', (field, input) => {
    expect(() => normalizer.normalize(source, input)).toThrow(
      FoodNormalizationError,
    );
    expect(() => normalizer.normalize(source, input)).toThrow(field);
  });

  it('define um contrato único para providers intercambiáveis', async () => {
    const provider: FoodProvider = {
      source: FoodSource.TBCA,
      search: async () => [food()],
      findByBarcode: async () => food(),
    };

    await expect(
      provider.search({ query: 'aveia', page: 1, limit: 20 }),
    ).resolves.toHaveLength(1);
    await expect(
      provider.findByBarcode('7891234567890'),
    ).resolves.toMatchObject({
      externalId: 'off-123',
    });
  });
});
