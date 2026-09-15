import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { UserProfile } from '../identity/user-profile.entity';
import type { UserStats } from '../gamification/user-stats.entity';
import type { BodyMeasurement } from '../identity/body-measurement.entity';
import type { DietPlan } from '../nutrition/diet-plan.entity';
import type { MealLog } from '../meals/meal-log.entity';
import type { GroupMember } from '../social/group-member.entity';
import type { FeedPost } from '../social/feed-post.entity';
import type { PostReaction } from '../social/post-reaction.entity';
import type { ChatMessage } from '../social/chat-message.entity';
import type { PointTransaction } from '../gamification/point-transaction.entity';
import type { UserAchievement } from '../gamification/user-achievement.entity';
import type { UserDailyMission } from '../gamification/user-daily-mission.entity';
import type { UserCosmetic } from '../gamification/user-cosmetic.entity';
import type { Group } from '../social/group.entity';

@Check(
  'users_email_format_check',
  "(((email)::text = lower(btrim((email)::text))) AND ((email)::text ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'::text))",
)
@Check(
  'users_username_format_check',
  "(((username)::text = lower(btrim((username)::text))) AND ((username)::text ~ '^[a-z0-9_]{3,50}$'::text))",
)
@Check(
  'users_display_name_not_blank_check',
  '(length(btrim((display_name)::text)) > 0)',
)
@Check(
  'users_password_hash_not_blank_check',
  '(length(btrim((password_hash)::text)) > 0)',
)
@Index('users_email_key', ['email'], { unique: true })
@Index('users_username_key', ['username'], { unique: true })
@Entity('users')
export class User {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'users_pkey',
  })
  id!: string;

  @Column({ name: 'email', type: 'varchar', length: 255 })
  email!: string;

  @Column({ name: 'password_hash', type: 'varchar', length: 255 })
  passwordHash!: string;

  @Column({ name: 'username', type: 'varchar', length: 50 })
  username!: string;

  @Column({ name: 'display_name', type: 'varchar', length: 100 })
  displayName!: string;

  @CreateDateColumn({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt!: Date;

  @UpdateDateColumn({
    name: 'updated_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  updatedAt!: Date;

  // UUIDs remain application-generated: the existing PostgreSQL columns have no default.
  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @OneToOne('UserProfile', 'user')
  profile?: Relation<UserProfile> | null;

  @OneToOne('UserStats', 'user')
  stats?: Relation<UserStats> | null;

  @OneToMany('BodyMeasurement', 'user')
  measurements!: Relation<BodyMeasurement>[];

  @OneToMany('DietPlan', 'user')
  dietPlans!: Relation<DietPlan>[];

  @OneToMany('MealLog', 'user')
  mealLogs!: Relation<MealLog>[];

  @OneToMany('GroupMember', 'user')
  groupMemberships!: Relation<GroupMember>[];

  @OneToMany('FeedPost', 'user')
  feedPosts!: Relation<FeedPost>[];

  @OneToMany('PostReaction', 'user')
  postReactions!: Relation<PostReaction>[];

  @OneToMany('ChatMessage', 'user')
  chatMessages!: Relation<ChatMessage>[];

  @OneToMany('PointTransaction', 'user')
  pointTransactions!: Relation<PointTransaction>[];

  @OneToMany('UserAchievement', 'user')
  achievements!: Relation<UserAchievement>[];

  @OneToMany('UserDailyMission', 'user')
  dailyMissions!: Relation<UserDailyMission>[];

  @OneToMany('UserCosmetic', 'user')
  cosmetics!: Relation<UserCosmetic>[];

  @OneToMany('Group', 'creator')
  createdGroups!: Relation<Group>[];
}
