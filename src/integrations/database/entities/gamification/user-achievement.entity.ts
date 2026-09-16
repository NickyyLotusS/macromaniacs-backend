import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { User } from '../identity/user.entity';
import type { Achievement } from '../catalogs/achievement.entity';

@Index('user_achievements_achievement_id_idx', ['achievementId'])
@Entity('user_achievements')
export class UserAchievement {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_achievements_pkey',
  })
  userId!: string;

  @PrimaryColumn({
    name: 'achievement_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_achievements_pkey',
  })
  achievementId!: string;

  @Column({
    name: 'unlocked_at',
    type: 'timestamptz',
    default: () => 'CURRENT_TIMESTAMP',
  })
  unlockedAt!: Date;

  @ManyToOne('User', 'achievements', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_achievements_user_id_fkey',
  })
  user!: Relation<User>;

  @ManyToOne('Achievement', 'users', {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'achievement_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_achievements_achievement_id_fkey',
  })
  achievement!: Relation<Achievement>;
}
