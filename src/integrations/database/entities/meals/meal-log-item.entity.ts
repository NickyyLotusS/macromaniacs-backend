import {
  BeforeInsert,
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { MealInputMethod } from '../enums';
import type { MealLog } from '../meals/meal-log.entity';
import type { Food } from '../nutrition/food.entity';

@Check('meal_log_items_amount_check', '(amount_grams > (0)::numeric)')
@Check(
  'meal_log_items_nutrients_check',
  '((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric))',
)
@Index('meal_log_items_meal_log_id_idx', ['mealLogId'])
@Index('meal_log_items_food_id_idx', ['foodId'])
@Entity('meal_log_items')
export class MealLogItem {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'meal_log_items_pkey',
  })
  id!: string;

  @Column({ name: 'meal_log_id', type: 'uuid' })
  mealLogId!: string;

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

  @Column({
    name: 'input_method',
    type: 'enum',
    enum: MealInputMethod,
    enumName: 'MealInputMethod',
  })
  inputMethod!: MealInputMethod;

  // UUIDs remain application-generated: the existing PostgreSQL columns have no default.
  @BeforeInsert()
  assignId(): void {
    this.id ??= randomUUID();
  }

  @ManyToOne('MealLog', 'items', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'meal_log_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'meal_log_items_meal_log_id_fkey',
  })
  mealLog!: Relation<MealLog>;

  @ManyToOne('Food', 'mealLogItems', {
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
    nullable: true,
  })
  @JoinColumn({
    name: 'food_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'meal_log_items_food_id_fkey',
  })
  food: Relation<Food> | null;
}
