import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { MealLogItem } from '../../integrations/database/entities/meals/meal-log-item.entity';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { PlannedMeal } from '../../integrations/database/entities/nutrition/planned-meal.entity';
import { OutboxEvent } from '../../integrations/database/entities/events/outbox-event.entity';
import { PlannedNutritionCalculator } from '../diet-plans/planned-nutrition.calculator';
import { ProgressModule } from '../progress/progress.module';
import { MealsController } from './meals.controller';
import { MealsService } from './meals.service';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MealLog,
      MealLogItem,
      Food,
      PlannedMeal,
      OutboxEvent,
    ]),
    ProgressModule,
    AuthModule,
    GamificationModule,
  ],
  controllers: [MealsController],
  providers: [MealsService, PlannedNutritionCalculator],
  exports: [MealsService],
})
export class MealsModule {}
