import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BodyMeasurement } from '../../integrations/database/entities/identity/body-measurement.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { User } from '../../integrations/database/entities/identity/user.entity';
import { AuthModule } from '../auth/auth.module';
import { NutritionCalculatorService } from './nutrition-calculator.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, UserProfile, BodyMeasurement]),
  ],
  controllers: [UsersController],
  providers: [UsersService, NutritionCalculatorService],
})
export class UsersModule {}
