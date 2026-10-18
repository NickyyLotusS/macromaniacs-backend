import { Module } from '@nestjs/common';
import { NutritionNormalizer } from './domain/nutrition-normalizer';

@Module({
  providers: [NutritionNormalizer],
  exports: [NutritionNormalizer],
})
export class FoodProductsModule {}
