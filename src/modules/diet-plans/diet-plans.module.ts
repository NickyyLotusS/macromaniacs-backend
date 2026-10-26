import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import { Food } from '../../integrations/database/entities/nutrition/food.entity';
import { PlannedMeal } from '../../integrations/database/entities/nutrition/planned-meal.entity';
import { PlannedMealItem } from '../../integrations/database/entities/nutrition/planned-meal-item.entity';
import { AuthModule } from '../auth/auth.module';
import { DietPlansController } from './diet-plans.controller';
import { DietPlansService } from './diet-plans.service';
import { PlannedMealsController } from './planned-meals.controller';
import { PlannedMealsService } from './planned-meals.service';
import { PlannedNutritionCalculator } from './planned-nutrition.calculator';

@Module({
  imports: [
    TypeOrmModule.forFeature([DietPlan, PlannedMeal, PlannedMealItem, Food]),
    AuthModule,
  ],
  controllers: [DietPlansController, PlannedMealsController],
  providers: [
    DietPlansService,
    PlannedMealsService,
    PlannedNutritionCalculator,
  ],
  exports: [DietPlansService],
})
export class DietPlansModule {}
