import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { TypeOrmFoodCatalogRepository } from '../../integrations/database/repositories/typeorm-food-catalog.repository';
import { AuthModule } from '../auth/auth.module';
import { FOOD_CATALOG_REPOSITORY } from './domain/food-catalog';
import { NutritionNormalizer } from './domain/nutrition-normalizer';
import { FoodCacheService } from './food-cache.service';
import { FoodProductsController } from './food-products.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Food]), AuthModule],
  controllers: [FoodProductsController],
  providers: [
    NutritionNormalizer,
    FoodCacheService,
    TypeOrmFoodCatalogRepository,
    {
      provide: FOOD_CATALOG_REPOSITORY,
      useExisting: TypeOrmFoodCatalogRepository,
    },
  ],
  exports: [NutritionNormalizer, FoodCacheService, FOOD_CATALOG_REPOSITORY],
})
export class FoodProductsModule {}
