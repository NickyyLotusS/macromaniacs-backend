import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  type Relation,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../auth/entities/user.entity';

@Entity({ name: 'user_stats' })
@Index('UQ_user_stats_user_date', ['userId', 'statDate'], { unique: true })
export class UserStat {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: Relation<User>;

  @Column({ name: 'stat_date', type: 'date' })
  statDate!: string;

  @Column({ name: 'age_years', type: 'smallint' })
  ageYears!: number;

  @Column({ name: 'bmr_kcal_per_day', type: 'integer' })
  bmrKcalPerDay!: number;

  @Column({ name: 'tdee_kcal_per_day', type: 'integer' })
  tdeeKcalPerDay!: number;

  @Column({ name: 'calorie_target_kcal_per_day', type: 'integer' })
  calorieTargetKcalPerDay!: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
