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
import { DietPlanStatus } from '../enums';
import type { User } from '../identity/user.entity';
import type { PlannedMeal } from '../nutrition/planned-meal.entity';

@Check('diet_plans_title_not_blank_check', '(length(btrim((title)::text)) > 0)')
@Check(
  'diet_plans_targets_check',
  '((target_calories > 0) AND (target_protein >= (0)::numeric) AND (target_carbs >= (0)::numeric) AND (target_fat >= (0)::numeric) AND (target_fiber >= (0)::numeric))',
)
@Check(
  'diet_plans_date_range_check',
  '((start_date IS NULL) OR (end_date IS NULL) OR (end_date >= start_date))',
)
@Index('diet_plans_user_id_status_idx', ['userId', 'status'])
@Entity('diet_plans')
export class DietPlan {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'diet_plans_pkey',
  })
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ name: 'title', type: 'varchar', length: 100 })
  title!: string;

  @Column({
    name: 'status',
    type: 'enum',
    enum: DietPlanStatus,
    enumName: 'DietPlanStatus',
    default: DietPlanStatus.ACTIVE,
  })
  status!: DietPlanStatus;

  @Column({ name: 'target_calories', type: 'integer' })
  targetCalories!: number;

  @Column({ name: 'target_protein', type: 'numeric', precision: 6, scale: 2 })
  targetProtein!: string;

  @Column({ name: 'target_carbs', type: 'numeric', precision: 6, scale: 2 })
  targetCarbs!: string;

  @Column({ name: 'target_fat', type: 'numeric', precision: 6, scale: 2 })
  targetFat!: string;

  @Column({
    name: 'target_fiber',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
  })
  targetFiber!: string;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ name: 'end_date', type: 'date', nullable: true })
  endDate: string | null;

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

  @ManyToOne('User', 'dietPlans', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'diet_plans_user_id_fkey',
  })
  user!: Relation<User>;

  @OneToMany('PlannedMeal', 'dietPlan')
  meals!: Relation<PlannedMeal>[];
}
