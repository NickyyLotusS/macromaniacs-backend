import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { validate } from './shared/config/env.validation';
import { DatabaseModule } from './integrations/database/database.module';
import { FoodProductsModule } from './modules/food-products/food-products.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
    }),
    DatabaseModule,
    FoodProductsModule,
    HealthModule,
  ],
})
export class AppModule {}
