import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Achievement } from '../../integrations/database/entities/catalogs/achievement.entity';
import { DailyMission } from '../../integrations/database/entities/catalogs/daily-mission.entity';
import { OutboxEvent } from '../../integrations/database/entities/events/outbox-event.entity';
import { PointTransaction } from '../../integrations/database/entities/gamification/point-transaction.entity';
import { UserAchievement } from '../../integrations/database/entities/gamification/user-achievement.entity';
import { UserDailyMission } from '../../integrations/database/entities/gamification/user-daily-mission.entity';
import { UserStats } from '../../integrations/database/entities/gamification/user-stats.entity';
import { UserProfile } from '../../integrations/database/entities/identity/user-profile.entity';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { DailyNutritionSnapshot } from '../../integrations/database/entities/nutrition/daily-nutrition-snapshot.entity';
import { DietPlan } from '../../integrations/database/entities/nutrition/diet-plan.entity';
import { FeedPost } from '../../integrations/database/entities/social/feed-post.entity';
import { GroupMember } from '../../integrations/database/entities/social/group-member.entity';
import { AuthModule } from '../auth/auth.module';
import { GamificationController } from './gamification.controller';
import { GamificationService } from './gamification.service';

@Module({
  imports: [
    AuthModule,
    TypeOrmModule.forFeature([
      Achievement,
      DailyMission,
      OutboxEvent,
      PointTransaction,
      UserAchievement,
      UserDailyMission,
      UserStats,
      UserProfile,
      MealLog,
      DailyNutritionSnapshot,
      DietPlan,
      FeedPost,
      GroupMember,
    ]),
  ],
  controllers: [GamificationController],
  providers: [GamificationService],
  exports: [GamificationService],
})
export class GamificationModule {}
