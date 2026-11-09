import {
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
import type { User } from '../identity/user.entity';

@Check(
  'daily_nutrition_snapshots_totals_check',
  '((calories >= (0)::numeric) AND (protein >= (0)::numeric) AND (carbs >= (0)::numeric) AND (fat >= (0)::numeric) AND (fiber >= (0)::numeric) AND (meal_count >= 0))',
)
@Check(
  'daily_nutrition_snapshots_timezone_not_blank_check',
  '(length(btrim((timezone)::text)) > 0)',
)
@Index('daily_nutrition_snapshots_user_id_food_date_idx', [
  'userId',
  'foodDate',
])
@Entity('daily_nutrition_snapshots')
export class DailyNutritionSnapshot {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'daily_nutrition_snapshots_pkey',
  })
  userId!: string;

  @PrimaryColumn({
    name: 'food_date',
    type: 'date',
    primaryKeyConstraintName: 'daily_nutrition_snapshots_pkey',
  })
  foodDate!: string;

  @Column({ name: 'timezone', type: 'varchar', length: 64 })
  timezone!: string;

  @Column({ name: 'calories', type: 'numeric', precision: 10, scale: 2 })
  calories!: string;

  @Column({ name: 'protein', type: 'numeric', precision: 10, scale: 2 })
  protein!: string;

  @Column({ name: 'carbs', type: 'numeric', precision: 10, scale: 2 })
  carbs!: string;

  @Column({ name: 'fat', type: 'numeric', precision: 10, scale: 2 })
  fat!: string;

  @Column({ name: 'fiber', type: 'numeric', precision: 10, scale: 2 })
  fiber!: string;

  @Column({ name: 'meal_count', type: 'integer', default: 0 })
  mealCount!: number;

  @Column({ name: 'target_calories', type: 'integer', nullable: true })
  targetCalories!: number | null;

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

  @ManyToOne('User', 'nutritionSnapshots', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'daily_nutrition_snapshots_user_id_fkey',
  })
  user!: Relation<User>;
}
