import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { Group } from '../social/group.entity';
import type { User } from '../identity/user.entity';
import type { MealLog } from '../meals/meal-log.entity';
import type { PostReaction } from '../social/post-reaction.entity';

@Check(
  'feed_posts_content_check',
  '((meal_log_id IS NOT NULL) OR ((content IS NOT NULL) AND (length(btrim(content)) > 0)))',
)
@Index('feed_posts_group_id_created_at_idx', { synchronize: false })
@Index('feed_posts_user_id_created_at_idx', { synchronize: false })
@Index('feed_posts_meal_log_id_idx', ['mealLogId'])
@Entity('feed_posts')
export class FeedPost {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'feed_posts_pkey',
  })
  id!: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'meal_log_id', type: 'uuid', nullable: true })
  mealLogId: string | null;

  @Column({ name: 'content', type: 'text', nullable: true })
  content: string | null;

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

  @ManyToOne('Group', 'feedPosts', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'group_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'feed_posts_group_id_fkey',
  })
  group!: Relation<Group>;

  @ManyToOne('User', 'feedPosts', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'feed_posts_user_id_fkey',
  })
  user!: Relation<User>;

  @ManyToOne('MealLog', 'feedPosts', {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'meal_log_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'feed_posts_meal_log_id_fkey',
  })
  mealLog: Relation<MealLog> | null;

  @OneToMany('PostReaction', 'post')
  reactions!: Relation<PostReaction>[];
}
