import { User } from './identity/user.entity';
import { UserProfile } from './identity/user-profile.entity';
import { BodyMeasurement } from './identity/body-measurement.entity';
import { UserStats } from './gamification/user-stats.entity';
import { Food } from './nutrition/food.entity';
import { DietPlan } from './nutrition/diet-plan.entity';
import { PlannedMeal } from './nutrition/planned-meal.entity';
import { PlannedMealItem } from './nutrition/planned-meal-item.entity';
import { MealLog } from './meals/meal-log.entity';
import { MealLogItem } from './meals/meal-log-item.entity';
import { Group } from './social/group.entity';
import { GroupMember } from './social/group-member.entity';
import { GroupChallenge } from './social/group-challenge.entity';
import { FeedPost } from './social/feed-post.entity';
import { PostReaction } from './social/post-reaction.entity';
import { ChatMessage } from './social/chat-message.entity';
import { PointTransaction } from './gamification/point-transaction.entity';
import { Achievement } from './catalogs/achievement.entity';
import { UserAchievement } from './gamification/user-achievement.entity';
import { DailyMission } from './catalogs/daily-mission.entity';
import { UserDailyMission } from './gamification/user-daily-mission.entity';
import { CosmeticItem } from './catalogs/cosmetic-item.entity';
import { UserCosmetic } from './gamification/user-cosmetic.entity';

export const DATABASE_ENTITIES = [
  User,
  UserProfile,
  BodyMeasurement,
  UserStats,
  Food,
  DietPlan,
  PlannedMeal,
  PlannedMealItem,
  MealLog,
  MealLogItem,
  Group,
  GroupMember,
  GroupChallenge,
  FeedPost,
  PostReaction,
  ChatMessage,
  PointTransaction,
  Achievement,
  UserAchievement,
  DailyMission,
  UserDailyMission,
  CosmeticItem,
  UserCosmetic,
];
