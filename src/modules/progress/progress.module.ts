import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DailyNutritionSnapshot } from '../../integrations/database/entities/nutrition/daily-nutrition-snapshot.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { ProgressController } from './progress.controller';
import { ProgressService } from './progress.service';
import { AuthModule } from '../auth/auth.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DailyNutritionSnapshot, UserProfile]),
    AuthModule,
    UsersModule,
  ],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
