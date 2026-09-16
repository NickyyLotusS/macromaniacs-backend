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
import type { User } from '../identity/user.entity';

@Check(
  'user_stats_streaks_check',
  '((current_streak >= 0) AND (best_streak >= current_streak))',
)
@Check('user_stats_total_points_check', '(total_points >= 0)')
@Entity('user_stats')
export class UserStats {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_stats_pkey',
  })
  userId!: string;

  @Column({ name: 'current_streak', type: 'integer', default: 0 })
  currentStreak!: number;

  @Column({ name: 'best_streak', type: 'integer', default: 0 })
  bestStreak!: number;

  @Column({ name: 'total_points', type: 'integer', default: 0 })
  totalPoints!: number;

  @Column({ name: 'last_activity_at', type: 'timestamptz', nullable: true })
  lastActivityAt: Date | null;

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

  @OneToOne('User', 'stats', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_stats_user_id_fkey',
  })
  user!: Relation<User>;
}
