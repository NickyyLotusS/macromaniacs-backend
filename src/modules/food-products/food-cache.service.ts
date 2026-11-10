import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import type { CreateManualFoodDto } from './dto/create-manual-food.dto';
import {
  DuplicateFoodBarcodeError,
  FOOD_CATALOG_REPOSITORY,
} from './domain/food-catalog';
import type { FoodCatalogRepository, FoodRecord } from './domain/food-catalog';
import type { FoodProvider, ProviderFood } from './domain/food-provider';
import {
  FoodNormalizationError,
  NutritionNormalizer,
} from './domain/nutrition-normalizer';

export type CachedFoodResult = {
  food: FoodRecord;
  cacheHit: boolean;
};

@Injectable()
export class FoodCacheService {
  constructor(
    @Inject(FOOD_CATALOG_REPOSITORY)
    private readonly repository: FoodCatalogRepository,
    private readonly normalizer: NutritionNormalizer,
  ) {}

  async findByBarcode(
    barcodeValue: string,
    provider: FoodProvider,
  ): Promise<CachedFoodResult | null> {
    const barcode = this.validateBarcode(barcodeValue);
    const cached = await this.repository.findByBarcode(barcode);

    if (cached) return { food: cached, cacheHit: true };

    const providerFood = await provider.findByBarcode(barcode);
    if (!providerFood) return null;

    const providerBarcode = providerFood.barcode?.trim();
    if (providerBarcode && providerBarcode !== barcode) {
      throw new FoodNormalizationError(
        'barcode',
        'does not match the requested value',
      );
    }

    const normalized = this.normalizer.normalize(provider.source, {
      ...providerFood,
      barcode,
    });
    return {
      food: await this.repository.saveExternal(normalized),
      cacheHit: false,
    };
  }

  async cacheProviderFood(
    provider: FoodProvider,
    food: ProviderFood,
  ): Promise<FoodRecord> {
    const cached = await this.repository.findByExternalIdentity(
      provider.source,
      food.externalId.trim(),
    );
    if (cached) return cached;

    return this.repository.saveExternal(
      this.normalizer.normalize(provider.source, food),
    );
  }

  async createManual(dto: CreateManualFoodDto): Promise<FoodRecord> {
    try {
      return await this.repository.createManual({
        name: dto.name,
        barcode: dto.barcode ?? null,
        caloriesPer100g: dto.caloriesPer100g.toFixed(2),
        proteinPer100g: dto.proteinPer100g.toFixed(2),
        carbsPer100g: dto.carbsPer100g.toFixed(2),
        fatPer100g: dto.fatPer100g.toFixed(2),
        fiberPer100g: dto.fiberPer100g.toFixed(2),
        servingSizeG: dto.servingSizeG.toFixed(2),
      });
    } catch (error) {
      if (error instanceof DuplicateFoodBarcodeError) {
        throw new ConflictException('barcode already exists');
      }
      throw error;
    }
  }

  private validateBarcode(value: string): string {
    const barcode = value.trim();
    if (!/^(?:\d{8}|\d{12,14})$/.test(barcode)) {
      throw new BadRequestException(
        'barcode must contain 8, 12, 13 or 14 digits',
      );
    }
    return barcode;
  }
}
