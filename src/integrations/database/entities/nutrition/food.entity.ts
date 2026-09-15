import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { FoodSource } from '../enums';
import type { PlannedMealItem } from '../nutrition/planned-meal-item.entity';
import type { MealLogItem } from '../meals/meal-log-item.entity';

@Check('foods_name_not_blank_check', '(length(btrim((name)::text)) > 0)')
@Check(
  'foods_external_id_check',
  '((external_id IS NULL) OR (length(btrim((external_id)::text)) > 0))',
)
@Check(
  'foods_barcode_check',
  '((barcode IS NULL) OR (length(btrim((barcode)::text)) > 0))',
)
@Check(
  'foods_nutrients_check',
  '((calories_per_100g >= (0)::numeric) AND (protein_per_100g >= (0)::numeric) AND (carbs_per_100g >= (0)::numeric) AND (fat_per_100g >= (0)::numeric) AND (fiber_per_100g >= (0)::numeric))',
)
@Check('foods_serving_size_g_check', '(serving_size_g > (0)::numeric)')
@Index('foods_source_external_id_key', ['source', 'externalId'], {
  unique: true,
})
@Index('foods_name_idx', ['name'])
@Index('foods_barcode_key', ['barcode'], { unique: true })
@Entity('foods')
export class Food {
  @PrimaryColumn({
    name: 'id',
    type: 'uuid',
    primaryKeyConstraintName: 'foods_pkey',
  })
  id!: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name!: string;

  @Column({
    name: 'source',
    type: 'enum',
    enum: FoodSource,
    enumName: 'FoodSource',
  })
  source!: FoodSource;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId: string | null;

  @Column({ name: 'barcode', type: 'varchar', length: 100, nullable: true })
  barcode: string | null;

  @Column({
    name: 'calories_per_100g',
    type: 'numeric',
    precision: 6,
    scale: 2,
  })
  caloriesPer100g!: string;

  @Column({ name: 'protein_per_100g', type: 'numeric', precision: 6, scale: 2 })
  proteinPer100g!: string;

  @Column({ name: 'carbs_per_100g', type: 'numeric', precision: 6, scale: 2 })
  carbsPer100g!: string;

  @Column({ name: 'fat_per_100g', type: 'numeric', precision: 6, scale: 2 })
  fatPer100g!: string;

  @Column({
    name: 'fiber_per_100g',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 0,
  })
  fiberPer100g!: string;

  @Column({
    name: 'serving_size_g',
    type: 'numeric',
    precision: 6,
    scale: 2,
    default: 100,
  })
  servingSizeG!: string;

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

  @OneToMany('PlannedMealItem', 'food')
  plannedMealItems!: Relation<PlannedMealItem>[];

  @OneToMany('MealLogItem', 'food')
  mealLogItems!: Relation<MealLogItem>[];
}
