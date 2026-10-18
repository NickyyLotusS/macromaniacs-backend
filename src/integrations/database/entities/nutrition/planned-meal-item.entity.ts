import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import type { PlannedMeal } from '../nutrition/planned-meal.entity';
import type { Food } from '../nutrition/food.entity';

@Check('planned_meal_items_amount_check', '(amount_grams > (0)::numeric)')
@Check(
  'planned_meal_items_nutrients_check',
  '((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric))',
)
@Index('planned_meal_items_planned_meal_id_idx', ['plannedMealId'])
@Index('planned_meal_items_food_id_idx', ['foodId'])
@Entity('planned_meal_items')
export class PlannedMealItem {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'planned_meal_items_pkey',
  })
  id!: string;

  @Column({ name: 'planned_meal_id', type: 'uuid' })
  plannedMealId!: string;

  @Column({ name: 'food_id', type: 'uuid', nullable: true })
  foodId: string | null;

  @Column({ name: 'amount_grams', type: 'numeric', precision: 6, scale: 2 })
  amountGrams!: string;

  @Column({ name: 'calories', type: 'numeric', precision: 8, scale: 2 })
  calories!: string;

  @Column({ name: 'protein', type: 'numeric', precision: 6, scale: 2 })
  protein!: string;

  @Column({ name: 'carbs', type: 'numeric', precision: 6, scale: 2 })
  carbs!: string;

  @Column({ name: 'fat', type: 'numeric', precision: 6, scale: 2 })
  fat!: string;

  @Column({
    name: 'fiber',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
  })
  fiber!: string;

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

  @ManyToOne('PlannedMeal', 'items', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'planned_meal_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'planned_meal_items_planned_meal_id_fkey',
  })
  plannedMeal!: Relation<PlannedMeal>;

  @ManyToOne('Food', 'plannedMealItems', {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'food_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'planned_meal_items_food_id_fkey',
  })
  food: Relation<Food> | null;
}
