import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { TypeOrmFoodCatalogRepository } from '../../integrations/database/repositories/typeorm-food-catalog.repository';
import { OpenFoodFactsProvider } from '../../integrations/food-providers/open-food-facts.provider';
import { ResilientFetchService } from '../../integrations/food-providers/resilient-fetch.service';
import { TbcaFoodProvider } from '../../integrations/food-providers/tbca.provider';
import { UsdaFoodDataProvider } from '../../integrations/food-providers/usda.provider';
import { AuthModule } from '../auth/auth.module';
import { FOOD_CATALOG_REPOSITORY } from './domain/food-catalog';
import type { FoodProvider } from './domain/food-provider';
import { NutritionNormalizer } from './domain/nutrition-normalizer';
import { FoodCacheService } from './food-cache.service';
import { FoodLookupService } from './food-lookup.service';
import { FoodProductsController } from './food-products.controller';
import { FOOD_PROVIDERS } from './food-provider.tokens';

@Module({
  imports: [TypeOrmModule.forFeature([Food]), AuthModule],
  controllers: [FoodProductsController],
  providers: [
    NutritionNormalizer,
    FoodCacheService,
    FoodLookupService,
    ResilientFetchService,
    OpenFoodFactsProvider,
    UsdaFoodDataProvider,
    TbcaFoodProvider,
    TypeOrmFoodCatalogRepository,
    {
      provide: FOOD_CATALOG_REPOSITORY,
      useExisting: TypeOrmFoodCatalogRepository,
    },
    {
      provide: FOOD_PROVIDERS,
      inject: [OpenFoodFactsProvider, UsdaFoodDataProvider, TbcaFoodProvider],
      useFactory: (
        openFoodFacts: OpenFoodFactsProvider,
        usda: UsdaFoodDataProvider,
        tbca: TbcaFoodProvider,
      ): readonly FoodProvider[] => [openFoodFacts, usda, tbca],
    },
  ],
  exports: [NutritionNormalizer, FoodCacheService, FOOD_CATALOG_REPOSITORY],
})
export class FoodProductsModule {}
