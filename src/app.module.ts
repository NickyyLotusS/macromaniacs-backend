import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { validate } from './shared/config/env.validation';
import { DatabaseModule } from './integrations/database/database.module';
import { FoodProductsModule } from './modules/food-products/food-products.module';
import { AuthModule } from './modules/auth/auth.module';
import { DietPlansModule } from './modules/diet-plans/diet-plans.module';
import { UsersModule } from './modules/users/users.module';
import { ProgressModule } from './modules/progress/progress.module';
import { MealsModule } from './modules/meals/meals.module';
import { GamificationModule } from './modules/gamification/gamification.module';
import { RewardsModule } from './modules/rewards/rewards.module';
import { SocialModule } from './modules/social/social.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
    }),
    DatabaseModule,
    FoodProductsModule,
    AuthModule,
    DietPlansModule,
    UsersModule,
    ProgressModule,
    MealsModule,
    GamificationModule,
    RewardsModule,
    SocialModule,
    HealthModule,
  ],
})
export class AppModule {}
