import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { BiologicalSex, UserGoal, ActivityLevel } from '../enums';
import type { User } from '../identity/user.entity';

@Check(
  'user_profiles_height_cm_check',
  '((height_cm IS NULL) OR (height_cm > (0)::numeric))',
)
@Check(
  'user_profiles_current_weight_kg_check',
  '((current_weight_kg IS NULL) OR (current_weight_kg > (0)::numeric))',
)
@Check(
  'user_profiles_target_weight_kg_check',
  '((target_weight_kg IS NULL) OR (target_weight_kg > (0)::numeric))',
)
@Check('user_profiles_birth_date_check', '(birth_date <= CURRENT_DATE)')
@Check(
  'user_profiles_target_date_check',
  '((target_date IS NULL) OR (target_date > birth_date))',
)
@Check(
  'user_profiles_dietary_note_check',
  '((dietary_restrictions_note IS NULL) OR (length(btrim(dietary_restrictions_note)) > 0))',
)
@Check(
  'user_profiles_avatar_config_check',
  "(jsonb_typeof(avatar_config) = 'object'::text)",
)
@Entity('user_profiles')
export class UserProfile {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_profiles_pkey',
  })
  userId!: string;

  @Column({ name: 'birth_date', type: 'date' })
  birthDate!: string;

  @Column({
    name: 'biological_sex',
    type: 'enum',
    enum: BiologicalSex,
    enumName: 'BiologicalSex',
  })
  biologicalSex!: BiologicalSex;

  @Column({ name: 'height_cm', type: 'numeric', precision: 5, scale: 2 })
  heightCm!: string;

  @Column({
    name: 'current_weight_kg',
    type: 'numeric',
    precision: 5,
    scale: 2,
  })
  currentWeightKg!: string;

  @Column({
    name: 'target_weight_kg',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  targetWeightKg: string | null;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate: string | null;

  @Column({ name: 'dietary_restrictions_note', type: 'text', nullable: true })
  dietaryRestrictionsNote: string | null;

  @Column({ name: 'goal', type: 'enum', enum: UserGoal, enumName: 'UserGoal' })
  goal!: UserGoal;

  @Column({
    name: 'activity_level',
    type: 'enum',
    enum: ActivityLevel,
    enumName: 'ActivityLevel',
  })
  activityLevel!: ActivityLevel;

  @Column({ name: 'avatar_config', type: 'jsonb', default: {} })
  avatarConfig!: Record<string, unknown>;

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

  @OneToOne('User', 'profile', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_profiles_user_id_fkey',
  })
  user!: Relation<User>;
}
