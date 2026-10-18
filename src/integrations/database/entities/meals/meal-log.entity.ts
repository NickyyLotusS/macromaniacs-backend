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
import type { User } from '../identity/user.entity';
import type { PlannedMeal } from '../nutrition/planned-meal.entity';
import type { MealLogItem } from '../meals/meal-log-item.entity';
import type { FeedPost } from '../social/feed-post.entity';

@Check('meal_logs_name_not_blank_check', '(length(btrim((name)::text)) > 0)')
@Check(
  'meal_logs_photo_url_check',
  '((photo_url IS NULL) OR (length(btrim((photo_url)::text)) > 0))',
)
@Index('meal_logs_user_id_consumed_at_idx', ['userId', 'consumedAt'])
@Index('meal_logs_planned_meal_id_idx', ['plannedMealId'])
@Entity('meal_logs')
export class MealLog {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'meal_logs_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'planned_meal_id', type: 'uuid', nullable: true })
  plannedMealId: string | null;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'photo_url', type: 'varchar', length: 500, nullable: true })
  photoUrl: string | null;

  @Column({
    name: 'consumed_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  consumedAt!: Date;

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

  @ManyToOne('User', 'mealLogs', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'meal_logs_user_id_fkey',
  })
  user!: Relation<User>;

  @ManyToOne('PlannedMeal', 'mealLogs', {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'planned_meal_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'meal_logs_planned_meal_id_fkey',
  })
  plannedMeal: Relation<PlannedMeal> | null;

  @OneToMany('MealLogItem', 'mealLog')
  items!: Relation<MealLogItem>[];

  @OneToMany('FeedPost', 'mealLog')
  feedPosts!: Relation<FeedPost>[];
}
