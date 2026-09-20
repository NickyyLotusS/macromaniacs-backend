import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { UserProfile } from '../auth/entities/user-profile.entity';
import { User } from '../auth/entities/user.entity';
import { BodyMeasurement } from './entities/body-measurement.entity';
import { UserStat } from './entities/user-stat.entity';
import { NutritionCalculatorService } from './nutrition-calculator.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([User, UserProfile, BodyMeasurement, UserStat]),
  ],
  controllers: [UsersController],
  providers: [UsersService, NutritionCalculatorService],
})
export class UsersModule {}
