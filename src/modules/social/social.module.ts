import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealLog } from '../../integrations/database/entities/meals/meal-log.entity';
import { FeedPost } from '../../integrations/database/entities/social/feed-post.entity';
import { GroupMember } from '../../integrations/database/entities/social/group-member.entity';
import { Group } from '../../integrations/database/entities/social/group.entity';
import { PostReaction } from '../../integrations/database/entities/social/post-reaction.entity';
import { AuthModule } from '../auth/auth.module';
import { GamificationModule } from '../gamification/gamification.module';
import { SocialController } from './social.controller';
import { SocialService } from './social.service';

@Module({
  imports: [
    AuthModule,
    GamificationModule,
    TypeOrmModule.forFeature([
      Group,
      GroupMember,
      FeedPost,
      PostReaction,
      MealLog,
    ]),
  ],
  controllers: [SocialController],
  providers: [SocialService],
})
export class SocialModule {}
