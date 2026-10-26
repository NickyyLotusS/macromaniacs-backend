import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import { AuthModule } from '../auth/auth.module';
import { DietPlansController } from './diet-plans.controller';
import { DietPlansService } from './diet-plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([DietPlan]), AuthModule],
  controllers: [DietPlansController],
  providers: [DietPlansService],
  exports: [DietPlansService],
})
export class DietPlansModule {}
