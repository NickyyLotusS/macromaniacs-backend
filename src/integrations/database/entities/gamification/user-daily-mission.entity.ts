import {
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import type { User } from '../identity/user.entity';
import type { DailyMission } from '../catalogs/daily-mission.entity';

@Check('user_daily_missions_progress_check', '(current_progress >= 0)')
@Index('user_daily_missions_mission_id_date_idx', ['missionId', 'date'])
@Entity('user_daily_missions')
export class UserDailyMission {
  @PrimaryColumn({
    name: 'user_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_daily_missions_pkey',
  })
  userId!: string;

  @PrimaryColumn({
    name: 'mission_id',
    type: 'uuid',
    primaryKeyConstraintName: 'user_daily_missions_pkey',
  })
  missionId!: string;

  @Column({ name: 'current_progress', type: 'integer', default: 0 })
  currentProgress!: number;

  @Column({ name: 'is_claimed', type: 'boolean', default: false })
  isClaimed!: boolean;

  @PrimaryColumn({
    name: 'date',
    type: 'date',
    primaryKeyConstraintName: 'user_daily_missions_pkey',
  })
  date!: string;

  @ManyToOne('User', 'dailyMissions', {
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'user_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_daily_missions_user_id_fkey',
  })
  user!: Relation<User>;

  @ManyToOne('DailyMission', 'users', {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    nullable: false,
  })
  @JoinColumn({
    name: 'mission_id',
    referencedColumnName: 'id',
    foreignKeyConstraintName: 'user_daily_missions_mission_id_fkey',
  })
  mission!: Relation<DailyMission>;
}
