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
import type { DietPlan } from '../nutrition/diet-plan.entity';
import type { PlannedMealItem } from '../nutrition/planned-meal-item.entity';
import type { MealLog } from '../meals/meal-log.entity';

@Check(
  'planned_meals_name_not_blank_check',
  '(length(btrim((name)::text)) > 0)',
)
@Check('planned_meals_order_index_check', '(order_index > 0)')
@Check(
  'planned_meals_targets_check',
  '(((target_calories IS NULL) OR (target_calories >= 0)) AND ((target_protein IS NULL) OR (target_protein >= (0)::numeric)) AND ((target_carbs IS NULL) OR (target_carbs >= (0)::numeric)) AND ((target_fat IS NULL) OR (target_fat >= (0)::numeric)))',
)
@Index(
  'planned_meals_diet_plan_id_order_index_key',
  ['dietPlanId', 'orderIndex'],
  { unique: true },
)
@Entity('planned_meals')
export class PlannedMeal {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'planned_meals_pkey',
  })
  id!: string;

  @Column({ name: 'diet_plan_id', type: 'uuid' })
  dietPlanId!: string;

  @Column({ name: 'name', type: 'varchar', length: 100 })
  name!: string;

  @Column({ name: 'order_index', type: 'integer', default: 1 })
  orderIndex!: number;

  @Column({ name: 'target_calories', type: 'integer', nullable: true })
  targetCalories: number | null;

  @Column({
    name: 'target_protein',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  targetProtein: string | null;

  @Column({
    name: 'target_carbs',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  targetCarbs: string | null;

  @Column({
    name: 'target_fat',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  targetFat: string | null;

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

  @ManyToOne('DietPlan', 'meals', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'diet_plan_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'planned_meals_diet_plan_id_fkey',
  })
  dietPlan!: Relation<DietPlan>;

  @OneToMany('PlannedMealItem', 'plannedMeal')
  items!: Relation<PlannedMealItem>[];

  @OneToMany('MealLog', 'plannedMeal')
  mealLogs!: Relation<MealLog>[];
}
