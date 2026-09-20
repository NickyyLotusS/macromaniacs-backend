import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import {
  ActivityLevel,
  BiologicalSex,
  NutritionGoal,
} from '../../users/domain/profile.enums';
import { numericTransformer } from '../../users/entities/numeric.transformer';

@Entity({ name: 'user_profiles' })
export class UserProfile {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', unique: true })
  userId!: string;

  @OneToOne(() => User, (user) => user.profile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ name: 'display_name', type: 'varchar', length: 80, nullable: true })
  displayName!: string | null;

  @Column({ name: 'date_of_birth', type: 'date', nullable: true })
  dateOfBirth!: string | null;

  @Column({ name: 'biological_sex', type: 'varchar', length: 10, nullable: true })
  biologicalSex!: BiologicalSex | null;

  @Column({ type: 'varchar', length: 24, nullable: true })
  goal!: NutritionGoal | null;

  @Column({ name: 'activity_level', type: 'varchar', length: 20, nullable: true })
  activityLevel!: ActivityLevel | null;

  @Column({
    name: 'target_weight_kg',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
    transformer: numericTransformer,
  })
  targetWeightKg!: number | null;

  @Column({ name: 'target_date', type: 'date', nullable: true })
  targetDate!: string | null;

  @Column({ name: 'dietary_restrictions', type: 'varchar', length: 1000, nullable: true })
  dietaryRestrictions!: string | null;

  @Column({ name: 'onboarding_completed', type: 'boolean', default: false })
  onboardingCompleted!: boolean;

  @Column({ name: 'onboarding_completed_at', type: 'timestamptz', nullable: true })
  onboardingCompletedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
